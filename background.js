const FEED_UA_RULE_ID = 1;

const GENERIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const GENERIC_CH_UA =
  '"Chromium";v="150", "Not(A:Brand";v="24", "Google Chrome";v="150"';
let ruleUpdateQueue = Promise.resolve();

function getFeedDomains(feeds) {
  const domains = new Set();
  for (const feed of Array.isArray(feeds) ? feeds : []) {
    try {
      const url = new URL(feed && feed.url);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        domains.add(url.hostname);
      }
    } catch (_) {
      // Invalid feed URLs are rejected by the settings page and RSS loader.
    }
  }
  return [...domains];
}

function updateFeedUARule(feeds, callback) {
  const requestDomains = getFeedDomains(feeds);
  const addRules = requestDomains.length ? [{
    id: FEED_UA_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'user-agent', operation: 'set', value: GENERIC_UA },
        { header: 'sec-ch-ua', operation: 'set', value: GENERIC_CH_UA },
        { header: 'sec-ch-ua-mobile', operation: 'set', value: '?0' },
        { header: 'sec-ch-ua-platform', operation: 'set', value: '"Windows"' },
        { header: 'sec-ch-ua-platform-version', operation: 'remove' },
        { header: 'sec-ch-ua-arch', operation: 'remove' },
        { header: 'sec-ch-ua-bitness', operation: 'remove' },
        { header: 'sec-ch-ua-model', operation: 'remove' },
        { header: 'sec-ch-ua-full-version-list', operation: 'remove' },
        { header: 'sec-ch-ua-wo64', operation: 'remove' }
      ]
    },
    condition: {
      // Both sides are required: CyberPage must initiate the request and the
      // destination must be one of the user's configured RSS hosts.
      initiatorDomains: [chrome.runtime.id],
      requestDomains,
      resourceTypes: ['xmlhttprequest', 'other']
    }
  }] : [];

  ruleUpdateQueue = ruleUpdateQueue.then(() => new Promise(resolve => {
    chrome.declarativeNetRequest.updateSessionRules(
      { removeRuleIds: [FEED_UA_RULE_ID], addRules },
      () => {
        const error = chrome.runtime.lastError;
        resolve(error ? { ok: false, error: error.message } : { ok: true });
      }
    );
  }));
  if (callback) ruleUpdateQueue.then(callback);
}

function refreshFeedUARule() {
  chrome.storage.sync.get({ rssFeeds: [] }, result => {
    updateFeedUARule(result.rssFeeds);
  });
}

refreshFeedUARule();
chrome.runtime.onInstalled.addListener(refreshFeedUARule);
chrome.runtime.onStartup.addListener(refreshFeedUARule);

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.rssFeeds) refreshFeedUARule();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ensureFeedUA') {
    updateFeedUARule(msg.feeds, sendResponse);
    return true;
  }
});
