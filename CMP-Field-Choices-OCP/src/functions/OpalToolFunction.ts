import { logger, storage } from '@zaiusinc/app-sdk';
import { ToolFunction, tool, ParameterType, OptiIdAuthData } from '@optimizely-opal/opal-tool-ocp-sdk';
import fetch from 'node-fetch';

const CMP_API_BASE = 'https://api.cmp.optimizely.com/v3';
const CMP_OAUTH_TOKEN_URL = 'https://accounts.cmp.optimizely.com/o/oauth2/v1/token';

const VALID_LABEL_COLORS = new Set([
  '#4ECFD5',
  '#FFC700',
  '#FF98A7',
  '#702BD5',
  '#5FEEAD',
  '#D6C4F2',
  '#5F9FF6',
  '#CB5DEB',
  '#9694B3',
]);

const VALID_LABEL_COLORS_LIST = [...VALID_LABEL_COLORS].join(', ');

/** CMP PATCH /work-requests/{id} — see OpenAPI / reference docs */
const WORK_REQUEST_STATUSES = new Set(['Accepted', 'Declined', 'Submitted', 'Completed']);
const WORK_REQUEST_PRIORITIES = new Set(['Low', 'Medium', 'High']);

interface CmpApiErrorDetail {
  statusCode: number;
  message: string;
  rawBody?: unknown;
}

interface CmpOAuthCredentials {
  cmp_client_id: string;
  cmp_client_secret: string;
}

interface CmpOAuthTokenStorage {
  access_token?: string;
  expires_at?: number | null;
  token_type?: string;
}

interface FieldChoiceInput {
  name: string;
  color?: string;
}

export class OpalToolFunction extends ToolFunction {

  protected async ready(): Promise<boolean> {
    return true;
  }

  private assertOptiIdAuthenticated(authData?: OptiIdAuthData): void {
    const token = authData?.credentials?.access_token;
    if (!token) {
      throw new Error(
        'OptiID authentication required. ' +
        'Please ensure you are logged in with your Optimizely account.'
      );
    }
  }

  private async getCmpAccessToken(): Promise<string> {
    const settings = await storage.settings.get('cmp_oauth_credentials') as unknown as CmpOAuthCredentials | undefined;
    const clientId = settings?.cmp_client_id?.trim();
    const clientSecret = settings?.cmp_client_secret?.trim();

    if (!clientId || !clientSecret) {
      throw new Error(
        'CMP OAuth2 credentials not configured. ' +
        'Please set cmp_client_id and cmp_client_secret in the app settings.'
      );
    }

    // Reuse cached token until close to expiry.
    try {
      const tokenStorage = await storage.secrets.get('cmp_oauth_tokens') as unknown as CmpOAuthTokenStorage | undefined;
      const cachedToken = tokenStorage?.access_token?.trim();
      const expiresAt = tokenStorage?.expires_at;
      if (cachedToken && expiresAt && Date.now() < expiresAt - 300000) {
        return cachedToken;
      }
    } catch {
      // Token cache is optional; we'll fetch a new one.
    }

    // Client Credentials flow.
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch(CMP_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // keep json null
    }

    if (!response.ok) {
      const message = json?.error_description || json?.message || text || 'CMP token request failed';
      throw new Error(`CMP OAuth token request failed: ${response.status} ${String(message)}`);
    }

    const accessToken = json?.access_token as string | undefined;
    const expiresIn = json?.expires_in as number | undefined;
    const tokenType = (json?.token_type as string | undefined) ?? 'Bearer';

    if (!accessToken) {
      throw new Error('CMP OAuth token response did not include access_token.');
    }

    const expiresAt = expiresIn
      ? Date.now() + Math.max(0, (expiresIn - 60) * 1000)
      : Date.now() + 55 * 60 * 1000;

    await storage.secrets.put('cmp_oauth_tokens', {
      access_token: accessToken,
      expires_at: expiresAt,
      token_type: tokenType,
    });

    return accessToken;
  }

  private async cmpRequest(
    method: string,
    path: string,
    accessToken: string,
    body?: unknown
  ): Promise<unknown> {
    const url = `${CMP_API_BASE}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: Record<string, unknown> = { method, headers };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(body);
    }

    logger.debug(`[CMP] ${method} ${path}`);
    const response = await fetch(url, options as any);
    const text = await response.text();

    if (!response.ok) {
      let responseBody: unknown = text;
      try {
        responseBody = text ? JSON.parse(text) : text;
      } catch {
        // keep raw text
      }
      this.throwCmpError(response.status, responseBody);
    }

    if (response.status === 204 || !text) {
      return null;
    }
    return JSON.parse(text);
  }

  private throwCmpError(statusCode: number, body: unknown): never {
    const detail = this.parseCmpError(statusCode, body);
    const err = new Error(detail.message) as Error & { errorDetails: CmpApiErrorDetail };
    err.errorDetails = detail;
    throw err;
  }

  private parseCmpError(statusCode: number, body: unknown): CmpApiErrorDetail {
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        return {
          statusCode,
          message: (parsed.message as string) ?? `CMP API Error (${statusCode})`,
          rawBody: parsed,
        };
      } catch {
        return { statusCode, message: body || `CMP API Error (${statusCode})` };
      }
    }
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      return {
        statusCode,
        message: (obj.message as string) ?? `CMP API Error (${statusCode})`,
        rawBody: obj,
      };
    }
    return { statusCode, message: `CMP API Error (${statusCode})` };
  }

  private toErrorResponse(error: unknown): {
    success: false;
    error: string;
    errorDetails?: CmpApiErrorDetail;
  } {
    const err = error as Error & { errorDetails?: CmpApiErrorDetail };
    return {
      success: false,
      error: err.message ?? String(error),
      ...(err.errorDetails ? { errorDetails: err.errorDetails } : {}),
    };
  }

  private parseChoicesInput(input: unknown): FieldChoiceInput[] {
    if (Array.isArray(input)) {
      return input as FieldChoiceInput[];
    }

    if (typeof input === 'string') {
      const raw = input.trim();
      if (!raw) {
        throw new Error('choices is required and must not be empty.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          'choices must be a valid JSON array string, e.g. ' +
          '[{"name":"Option A"},{"name":"Option B"}]'
        );
      }

      if (!Array.isArray(parsed)) {
        throw new Error('choices JSON must be an array.');
      }

      return parsed as FieldChoiceInput[];
    }

    throw new Error(
      'choices must be a JSON array string, e.g. ' +
      '[{"name":"Option A"},{"name":"Option B"}]'
    );
  }

  // WORK REQUESTS — PATCH /work-requests/{id}
  // https://docs.developers.optimizely.com/content-marketing-platform/reference/patch_work-requests-id

  @tool({
    name: 'cmp_approve_work_request',
    description:
      'Approve a CMP work request by setting its status to Accepted. ' +
      'Calls PATCH /work-requests/{id} with body { "status": "Accepted" }. ' +
      'Use cmp_patch_work_request for other status or priority updates.',
    endpoint: '/cmp_approve_work_request',
    authRequirements: [
      { provider: 'OptiID', scopeBundle: 'default', required: true },
    ],
    parameters: [
      {
        name: 'work_request_id',
        type: ParameterType.String,
        description: 'GUID of the work request to approve',
        required: true,
      },
    ],
  })
  public async approveWorkRequest(
    params: { work_request_id: string },
    authData?: OptiIdAuthData
  ): Promise<any> {
    try {
      this.assertOptiIdAuthenticated(authData);
      const accessToken = await this.getCmpAccessToken();
      const id = params.work_request_id?.trim();
      if (!id) {
        return { success: false, error: 'work_request_id is required.' };
      }

      await this.cmpRequest(
        'PATCH',
        `/work-requests/${encodeURIComponent(id)}`,
        accessToken,
        { status: 'Accepted' }
      );

      return {
        success: true,
        message: 'Work request approved (status set to Accepted).',
        work_request_id: id,
        status: 'Accepted',
      };
    } catch (error: unknown) {
      logger.error('[CMP] Error approving work request:', error);
      return this.toErrorResponse(error);
    }
  }

  @tool({
    name: 'cmp_patch_work_request',
    description:
      'Update a CMP work request (status, priority, assignees). ' +
      'PATCH /work-requests/{id}. At least one of status, priority, or assignees ' +
      'must be provided. Status: Accepted, Declined, Submitted, Completed. ' +
      'Priority: Low, Medium, High. assignees: list of user identifier strings.',
    endpoint: '/cmp_patch_work_request',
    authRequirements: [
      { provider: 'OptiID', scopeBundle: 'default', required: true },
    ],
    parameters: [
      {
        name: 'work_request_id',
        type: ParameterType.String,
        description: 'GUID of the work request to update',
        required: true,
      },
      {
        name: 'status',
        type: ParameterType.String,
        description:
          'Optional. One of: Accepted, Declined, Submitted, Completed',
        required: false,
      },
      {
        name: 'priority',
        type: ParameterType.String,
        description: 'Optional. One of: Low, Medium, High',
        required: false,
      },
      {
        name: 'assignees',
        type: ParameterType.List,
        description:
          'Optional. List of user ids (strings) assigned to the work request',
        required: false,
      },
    ],
  })
  public async patchWorkRequest(
    params: {
      work_request_id: string;
      status?: string;
      priority?: string;
      assignees?: string[];
    },
    authData?: OptiIdAuthData
  ): Promise<any> {
    try {
      this.assertOptiIdAuthenticated(authData);
      const accessToken = await this.getCmpAccessToken();
      const id = params.work_request_id?.trim();
      if (!id) {
        return { success: false, error: 'work_request_id is required.' };
      }

      const body: Record<string, unknown> = {};

      if (params.status != null && String(params.status).trim() !== '') {
        const s = String(params.status).trim();
        if (!WORK_REQUEST_STATUSES.has(s)) {
          return {
            success: false,
            error: `Invalid status "${s}". Allowed: ${[...WORK_REQUEST_STATUSES].join(', ')}`,
          };
        }
        body.status = s;
      }

      if (params.priority != null && String(params.priority).trim() !== '') {
        const p = String(params.priority).trim();
        if (!WORK_REQUEST_PRIORITIES.has(p)) {
          return {
            success: false,
            error: `Invalid priority "${p}". Allowed: ${[...WORK_REQUEST_PRIORITIES].join(', ')}`,
          };
        }
        body.priority = p;
      }

      if (params.assignees != null) {
        if (!Array.isArray(params.assignees)) {
          return {
            success: false,
            error: 'assignees must be a list of strings when provided.',
          };
        }
        const list = (
          params.assignees.map((a) => String(a).trim()).filter((a) => a.length > 0)
        );
        body.assignees = list;
      }

      if (Object.keys(body).length === 0) {
        return {
          success: false,
          error: 'Provide at least one of: status, priority, assignees.',
        };
      }

      await this.cmpRequest(
        'PATCH',
        `/work-requests/${encodeURIComponent(id)}`,
        accessToken,
        body
      );

      return {
        success: true,
        message: 'Work request updated.',
        work_request_id: id,
        updated: body,
      };
    } catch (error: unknown) {
      logger.error('[CMP] Error patching work request:', error);
      return this.toErrorResponse(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET FIELD VALUES
  // GET /fields?ids={field_id}
  // ═══════════════════════════════════════════════════════════════════════════

  @tool({
    name: 'cmp_get_field_values',
    description:
      'Retrieve one or more CMP fields by their GUIDs, ' +
      'including the field definition and its current choices. ' +
      'Returns the full field object(s) from the CMP API.',
    endpoint: '/cmp_get_field_values',
    authRequirements: [
      { provider: 'OptiID', scopeBundle: 'default', required: true },
    ],
    parameters: [
      {
        name: 'field_ids',
        type: ParameterType.String,
        description:
          'Comma-separated list of field GUIDs to retrieve, ' +
          'e.g. "guid1" or "guid1,guid2"',
        required: true,
      },
    ],
  })
  public async getFieldValues(
    params: { field_ids: string },
    authData?: OptiIdAuthData
  ): Promise<any> {
    try {
      this.assertOptiIdAuthenticated(authData);
      const accessToken = await this.getCmpAccessToken();

      const ids = params.field_ids.trim();
      if (!ids) {
        return {
          success: false,
          error: 'field_ids is required and must not be empty.',
        };
      }

      const result = await this.cmpRequest(
        'GET',
        `/fields?ids=${encodeURIComponent(ids)}`,
        accessToken
      );

      const items = Array.isArray(result) ? result : [result];

      return {
        success: true,
        count: items.length,
        fields: items,
      };
    } catch (error: unknown) {
      logger.error('[CMP] Error retrieving field values:', error);
      return this.toErrorResponse(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE FIELD CHOICE
  // PATCH /fields/{field_id}/choices/{choice_id}
  // ═══════════════════════════════════════════════════════════════════════════

  @tool({
    name: 'cmp_update_field_choice',
    description:
      'Update an existing choice on a CMP field ' +
      '(label, dropdown, checkbox, or radio button). ' +
      'For labels you can update name and/or color. ' +
      'Allowed colors: #4ECFD5, #FFC700, #FF98A7, ' +
      '#702BD5, #5FEEAD, #D6C4F2, #5F9FF6, #CB5DEB, #9694B3.',
    endpoint: '/cmp_update_field_choice',
    authRequirements: [
      { provider: 'OptiID', scopeBundle: 'default', required: true },
    ],
    parameters: [
      {
        name: 'field_id',
        type: ParameterType.String,
        description: 'GUID of the field containing the choice',
        required: true,
      },
      {
        name: 'choice_id',
        type: ParameterType.String,
        description: 'GUID of the choice to update',
        required: true,
      },
      {
        name: 'name',
        type: ParameterType.String,
        description: 'New name for the choice (min 1 character)',
        required: false,
      },
      {
        name: 'color',
        type: ParameterType.String,
        description:
          'Hex color for label choices only. ' +
          'Allowed: #4ECFD5 #FFC700 #FF98A7 #702BD5 ' +
          '#5FEEAD #D6C4F2 #5F9FF6 #CB5DEB #9694B3',
        required: false,
      },
    ],
  })
  public async updateFieldChoice(
    params: { field_id: string; choice_id: string; name?: string; color?: string },
    authData?: OptiIdAuthData
  ): Promise<any> {
    try {
      this.assertOptiIdAuthenticated(authData);
      const accessToken = await this.getCmpAccessToken();

      if (!params.name && !params.color) {
        return {
          success: false,
          error: 'At least one of "name" or "color" must be provided.',
        };
      }

      if (params.color && !VALID_LABEL_COLORS.has(params.color.toUpperCase())) {
        return {
          success: false,
          error: `Invalid color "${params.color}". ` +
            `Allowed: ${VALID_LABEL_COLORS_LIST}`,
        };
      }

      const body: Record<string, string> = {};
      if (params.name) body.name = params.name;
      if (params.color) body.color = params.color;

      await this.cmpRequest(
        'PATCH',
        `/fields/${params.field_id}/choices/${params.choice_id}`,
        accessToken,
        body
      );

      return {
        success: true,
        message: 'Field choice updated successfully',
        field_id: params.field_id,
        choice_id: params.choice_id,
        updated: body,
      };
    } catch (error: unknown) {
      logger.error('[CMP] Error updating field choice:', error);
      return this.toErrorResponse(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD FIELD CHOICES
  // POST /fields/{field_id}/choices
  // ═══════════════════════════════════════════════════════════════════════════

  @tool({
    name: 'cmp_add_field_choices',
    description:
      'Add one or more new choices to a CMP field ' +
      '(label, dropdown, checkbox, or radio button). ' +
      'Labels need name + color; others need name only. ' +
      'Allowed colors: #4ECFD5, #FFC700, #FF98A7, ' +
      '#702BD5, #5FEEAD, #D6C4F2, #5F9FF6, #CB5DEB, #9694B3.',
    endpoint: '/cmp_add_field_choices',
    authRequirements: [
      { provider: 'OptiID', scopeBundle: 'default', required: true },
    ],
    parameters: [
      {
        name: 'field_id',
        type: ParameterType.String,
        description: 'GUID of the field to add choices to',
        required: true,
      },
      {
        name: 'choices',
        type: ParameterType.String,
        description:
          'JSON array string of {name, color?} objects. Labels: ' +
          '"[{\\"name\\":\\"X\\",\\"color\\":\\"#FFC700\\"}]". ' +
          'Others: "[{\\"name\\":\\"A\\"},{\\"name\\":\\"B\\"}]"',
        required: true,
      },
    ],
  })
  public async addFieldChoices(
    params: { field_id: string; choices: string },
    authData?: OptiIdAuthData
  ): Promise<any> {
    try {
      this.assertOptiIdAuthenticated(authData);
      const accessToken = await this.getCmpAccessToken();

      const choices = this.parseChoicesInput(params.choices);

      if (!choices || choices.length === 0) {
        return {
          success: false,
          error: 'At least one choice must be provided.',
        };
      }

      for (const choice of choices) {
        if (!choice.name || choice.name.trim().length === 0) {
          return {
            success: false,
            error: 'Each choice must have a non-empty "name" property.',
          };
        }
        if (choice.color && !VALID_LABEL_COLORS.has(choice.color.toUpperCase())) {
          return {
            success: false,
            error: `Invalid color "${choice.color}" for ` +
              `"${choice.name}". Allowed: ${VALID_LABEL_COLORS_LIST}`,
          };
        }
      }

      const result = await this.cmpRequest(
        'POST',
        `/fields/${params.field_id}/choices`,
        accessToken,
        choices
      );

      return {
        success: true,
        message: `${choices.length} choice(s) added successfully`,
        field_id: params.field_id,
        choices: result,
      };
    } catch (error: unknown) {
      logger.error('[CMP] Error adding field choices:', error);
      return this.toErrorResponse(error);
    }
  }
}
