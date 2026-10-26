/* The extension talks only to the local JobMatch app, never directly to OpenAI. */
const JobMatchApi = {
  defaultOrigin: 'http://127.0.0.1:8000',
  validateOrigin(value) {
    let url;
    try { url = new URL(value); } catch { throw Error('Enter a local app address, such as http://127.0.0.1:8000.'); }
    if (url.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw Error('Use the local app address only, such as http://127.0.0.1:8000.');
    }
    return url.origin;
  },
  async origin() {
    const {appOrigin} = await chrome.storage.local.get('appOrigin');
    return this.validateOrigin(appOrigin || this.defaultOrigin);
  },
  error(message, code) {
    const error = new Error(message); error.code = code; return error;
  },
  incompatible(origin) {
    return this.error(`A server is responding at ${origin}, but it is not the current JobMatch AI app. Stop the old server, pull the latest code, and run python run.py from the JobMatchAI folder. If using another port, update Connection settings in the extension panel.`, 'INCOMPATIBLE_SERVER');
  },
  async checkConnection() {
    const identity = await this.request('/health');
    if (identity.service !== 'jobmatch-ai' || identity.apiVersion !== 2 ||
        !Array.isArray(identity.features) || !identity.features.includes('saved-profile') || !identity.features.includes('tailored-autofill') || !identity.features.includes('saved-autofill') || !identity.features.includes('subscription-tailoring') || !identity.features.includes('draft-history')) {
      throw this.incompatible(await this.origin());
    }
  },
  async request(path, data, method = data === undefined ? 'GET' : 'POST') {
    const origin = await this.origin();
    let response;
    try {
      response = await fetch(origin + path, {
        method,
        headers: data === undefined || data instanceof FormData ? {} : {'Content-Type':'application/json'},
        body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
        signal: AbortSignal.timeout(path === '/health' || path === '/candidate' ? 5000 : 180000),
      });
    } catch (error) {
      if (error.name === 'TimeoutError' && path !== '/health' && path !== '/candidate') throw Error('Tailoring took too long. Check the local app terminal and try again.');
      throw this.error(`Cannot reach JobMatch AI at ${origin}. Start python run.py, and check the app address in the extension panel’s Connection settings.`, 'OFFLINE');
    }
    if (response.status === 404) throw this.incompatible(origin);
    let body;
    try {body = await response.json();}
    catch {throw this.incompatible(origin);}
    if (!body || typeof body !== 'object') throw this.incompatible(origin);
    if (!response.ok) throw Error(typeof body.detail === 'string' ? body.detail : 'The local app could not complete this request.');
    return body;
  }
};
