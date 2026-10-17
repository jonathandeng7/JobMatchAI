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
  async request(path, data) {
    const origin = await this.origin();
    let response;
    try {
      response = await fetch(origin + path, {
        method: data === undefined ? 'GET' : 'POST',
        headers: data === undefined ? {} : {'Content-Type':'application/json'},
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(180000),
      });
    } catch (error) {
      if (error.name === 'TimeoutError') throw Error('Tailoring took too long. Check the local app terminal and try again.');
      throw Error('Cannot reach JobMatch AI. Start python run.py, and check the app address in extension settings.');
    }
    const body = await response.json();
    if (!response.ok) throw Error(typeof body.detail === 'string' ? body.detail : 'The local app could not complete this request.');
    return body;
  }
};
