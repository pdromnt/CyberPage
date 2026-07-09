const FEED_UA_RULE_ID = 1;

const GENERIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const GENERIC_CH_UA =
  '"Chromium";v="150", "Not(A:Brand";v="24", "Google Chrome";v="150"';

const FEED_UA_RULE = {
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
  condition: { resourceTypes: ['xmlhttprequest', 'other'] }
};

function ensureFeedUARule() {
  chrome.declarativeNetRequest.updateSessionRules(
    { removeRuleIds: [FEED_UA_RULE_ID], addRules: [FEED_UA_RULE] },
    () => { void chrome.runtime.lastError; }
  );
}

ensureFeedUARule();
chrome.runtime.onInstalled.addListener(ensureFeedUARule);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ensureFeedUA') {
    chrome.declarativeNetRequest.updateSessionRules(
      { removeRuleIds: [FEED_UA_RULE_ID], addRules: [FEED_UA_RULE] },
      () => {
        void chrome.runtime.lastError;
        sendResponse({ ok: true });
      }
    );
    return true;
  }
});
