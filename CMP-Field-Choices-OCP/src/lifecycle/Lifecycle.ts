import {
  Lifecycle as AppLifecycle,
  LifecycleResult,
  LifecycleSettingsResult,
  storage,
  logger,
  SubmittedFormData
} from '@zaiusinc/app-sdk';
import fetch from 'node-fetch';

const CMP_OAUTH_TOKEN_URL = 'https://accounts.cmp.optimizely.com/o/oauth2/v1/token';

interface CmpOAuthCredentials {
  cmp_client_id: string;
  cmp_client_secret: string;
}

export class Lifecycle extends AppLifecycle {
  public async onInstall(): Promise<LifecycleResult> {
    logger.info('CMP Field Choices app installed');
    return { success: true };
  }

  public async onSettingsForm(
    section: string,
    action: string,
    formData: SubmittedFormData
  ): Promise<LifecycleSettingsResult> {
    const result = new LifecycleSettingsResult();

    try {
      if (section === 'cmp_oauth_credentials' && action === 'validate_credentials') {
        const credentials = formData as unknown as CmpOAuthCredentials;

        const clientId = credentials?.cmp_client_id?.trim();
        const clientSecret = credentials?.cmp_client_secret?.trim();

        if (!clientId || !clientSecret) {
          return result.addToast('warning', 'Please provide both CMP Client ID and CMP Client Secret.');
        }

        // Validate by requesting a token using the Client Credentials flow.
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

        if (response.ok) {
          const accessToken = json?.access_token as string | undefined;
          const expiresIn = json?.expires_in as number | undefined;
          const tokenType = (json?.token_type as string | undefined) ?? 'Bearer';

          if (!accessToken) {
            return result.addToast(
              'danger',
              'CMP token request succeeded, but no access_token was returned. Please check your CMP OAuth app configuration.'
            );
          }

          const expiresAt = expiresIn
            ? Date.now() + Math.max(0, (expiresIn - 60) * 1000)
            : Date.now() + 55 * 60 * 1000;

          // Persist credentials and (optionally) the first token so the tool is ready immediately.
          await storage.settings.put('cmp_oauth_credentials', {
            cmp_client_id: clientId,
            cmp_client_secret: clientSecret,
          });

          await storage.secrets.put('cmp_oauth_tokens', {
            access_token: accessToken,
            expires_at: expiresAt,
            token_type: tokenType,
          });

          return result.addToast('success', 'CMP OAuth2 Client Credentials validated.');
        }

        // Common failure is "client credentials not allowed" or invalid client/secret.
        const statusText = response.statusText ? ` ${response.statusText}` : '';
        const message = json?.error_description || json?.message || text || 'Token request failed';

        return result.addToast(
          'danger',
          `Failed to validate CMP credentials: ${response.status}${statusText}. ${String(message)}`
        );
      }

      return result;
    } catch (error: unknown) {
      logger.error('[CMP] Error validating OAuth credentials:', error);
      return result.addToast('danger', 'Unable to validate CMP OAuth credentials. Please try again.');
    }
  }

  public async onUpgrade(_fromVersion: string): Promise<LifecycleResult> {
    return { success: true };
  }

  public async onFinalizeUpgrade(_fromVersion: string): Promise<LifecycleResult> {
    return { success: true };
  }

  public async onUninstall(): Promise<LifecycleResult> {
    logger.info('CMP Field Choices app uninstalled');
    return { success: true };
  }

  public async onAuthorizationRequest(
    _page: string,
    _formData: SubmittedFormData
  ): Promise<LifecycleSettingsResult> {
    return new LifecycleSettingsResult();
  }

  public async onAuthorizationGrant(_request: any): Promise<any> {
    return { type: 'oauth' };
  }
}
