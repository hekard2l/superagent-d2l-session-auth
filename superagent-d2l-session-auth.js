'use strict';

var url = require('url'),
	xsrf = require('frau-superagent-xsrf-token');

function noop() {}

function isRelative/*ly safe*/(url) {
	return url.hostname === null;
}

function endsWith(haystack, needle) {
	var expectedPosition = haystack.length - needle.length;
	var lastIndex = haystack.indexOf(needle, expectedPosition);
	var result = lastIndex !== -1 && lastIndex === expectedPosition;
	return result;
}

function isBrightspaceApi(url) {
	return url.protocol === 'https:'
		&& (url.hostname === 'api.brightspace.com'
			|| endsWith(url.hostname, '.api.brightspace.com')
		);
}

function isTrustedHost(url, trustedHost) {
	return typeof trustedHost === 'string'
		&& url.host === trustedHost.toLowerCase();
}

function isTrusted(parsed, trustedHost) {
	return isBrightspaceApi(parsed)
		|| isTrustedHost(parsed, trustedHost);
}

module.exports = function(getJwt, opts) {
	opts = opts || {};

	return function(req) {
		req = req.use(xsrf);

		var end = req.end;
		req.end = function(cb) {
			function finish() {
				req.end = end;
				req.end(cb);
			}

			var parsed = url.parse(req.url);

			if (isRelative(parsed) || !isTrusted(parsed, opts.trustedHost)) {
				finish();
				return this;
			}

			getJwt(opts.scope)
				.then(function(token) {
					req.set('Authorization', 'Bearer ' + token);
				})
				.catch(noop)
				.then(function() {
					// Run this async in another turn
					// So we don't catch errors with our Promise
					setTimeout(finish);
				});

			return this;
		};

		return req;
	};
};
