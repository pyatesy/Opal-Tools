import * as App from '@zaiusinc/app-sdk';
import {
  Lifecycle as AppLifecycle,
  AuthorizationGrantResult,
  LifecycleResult,
  LifecycleSettingsResult,
  logger,
  Request,
  storage,
  SubmittedFormData
} from '@zaiusinc/app-sdk';

export class Lifecycle extends AppLifecycle {
  public async onInstall(): Promise<LifecycleResult> {
    try {
      logger.info('Performing Monday.com Integration Install');

      // Get function URLs and store them for the settings form
      const functionUrls = await App.functions.getEndpoints();
      await App.storage.settings.put('instructions', {
        opal_tool_url: `${functionUrls.opal_tool}/discovery`,
        function_urls: functionUrls
      });

      return { success: true };
    } catch (error: any) {
      logger.error('Error during installation:', error);
      return {
        success: false,
        retryable: true,
        message: `Error during installation: ${error}`,
      };
    }
  }

  public async onSettingsForm(
    section: string,
    action: string,
    formData: SubmittedFormData
  ): Promise<LifecycleSettingsResult> {
    const result = new LifecycleSettingsResult();
    try {
      // Handle Monday.com API token save
      if (section === 'monday_auth' && action === 'save_token') {
        await storage.settings.put(section, formData);
        result.addToast('success', 'Monday.com API token saved successfully!');
      }

      // Handle API token validation
      if (section === 'monday_auth' && action === 'validate_token') {
        const apiToken = formData.api_token as string;

        if (!apiToken || apiToken.trim() === '') {
          result.addToast('warning', 'Please enter a Monday.com API token.');
          return result;
        }

        // Validate token by making a test API call
        try {
          const testResponse = await fetch('https://api.monday.com/v2', {
            method: 'POST',
            headers: {
              'Authorization': apiToken,
              'Content-Type': 'application/json',
              'API-Version': '2024-01'
            },
            body: JSON.stringify({
              query: 'query { me { id name } }'
            })
          });

          if (testResponse.ok) {
            await storage.settings.put(section, formData);
            result.addToast('success', 'API token validated successfully!');
          } else {
            result.addToast('warning', 'Invalid API token. Please check your token and try again.');
          }
        } catch (error: any) {
          logger.error('Token validation error:', error);
          result.addToast('warning', 'Failed to validate token. Please check your connection and try again.');
        }
      }

      return result;
    } catch (error: any) {
      logger.error('Error in settings form handler:', error);
      return result.addToast(
        'danger',
        'Sorry, an unexpected error occurred. Please try again in a moment.'
      );
    }
  }

  public async onAuthorizationRequest(
    _section: string,
    _formData: SubmittedFormData
  ): Promise<LifecycleSettingsResult> {
    const result = new LifecycleSettingsResult();
    // Monday.com uses API tokens, not OAuth for this integration
    return result.addToast(
      'info',
      'Monday.com integration uses API tokens. Please configure your token in the settings.'
    );
  }

  public async onAuthorizationGrant(
    _request: Request
  ): Promise<AuthorizationGrantResult> {
    return new AuthorizationGrantResult('').addToast(
      'info',
      'Monday.com integration uses API tokens, not OAuth.'
    );
  }

  public async onUpgrade(_fromVersion: string): Promise<LifecycleResult> {
    try {
      // Update function URLs on upgrade
      const functionUrls = await App.functions.getEndpoints();
      await App.storage.settings.put('instructions', {
        opal_tool_url: `${functionUrls.opal_tool}/discovery`,
        function_urls: functionUrls
      });
      return { success: true };
    } catch (error: any) {
      logger.error('Error during upgrade:', error);
      return {
        success: false,
        retryable: true,
        message: `Error during upgrade: ${error}`,
      };
    }
  }

  public async onFinalizeUpgrade(
    _fromVersion: string
  ): Promise<LifecycleResult> {
    return { success: true };
  }

  public async onAfterUpgrade(): Promise<LifecycleResult> {
    return { success: true };
  }

  public async onUninstall(): Promise<LifecycleResult> {
    // Clean up any stored data if needed
    return { success: true };
  }
}

