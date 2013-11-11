/**
 * Creates objects needed for the application to run
 */
$(document).ready(function onReady() {
  var apiKey = '66e5ba4e61579ba289e6b8b7b0ac5520';
  var sharedSecret = '1d1cc8bfab1db680';
  var app = new ApplicationModel(apiKey, sharedSecret);
  ko.applyBindings(app);
});

/**
 * Creates an instance of a RememberTheMilk API object
 *
 * @constructor
 * @this {RTM}
 * @param {string} apiKey The API key as given by RememberTheMilk
 * @param {string} sharedSecret The shared secret as given by RememberTheMilk
 * @returns {RTM} The new RTM object
 */
function RTM(apiKey, sharedSecret) {
  var authUrl = 'http://www.rememberthemilk.com/services/auth/';
  var restUrl = 'http://api.rememberthemilk.com/services/rest/';
  var callbackName = 'rtmApiCallback';
  var paramsDefaults = {
    'api_key': apiKey,
    'format': 'json',
    'callback': callbackName,
  };

  /**
   * Sends API request with parameters to API service
   *
   * @param {object} params Parameters to use in the API request
   * @param {function} success Callback to be executed on successful response
   * @param {function} failure Callback to be executed on failed response
   * @returns {null}
   */
  function sendRequest(params, success, failure) {
    var url;
    if (!success) {
      success = function() {};
    }
    if (!failure) {
      failure = function() {};
    }

    _.extend(params, paramsDefaults);
    params.api_sig = getSignature(params);
    url = restUrl + getEncodedParams(params);

    // Generate callback function
    window[callbackName] = function(data) {
      console.log('Response received:', data);
      if (data.rsp.stat == 'ok') {
        success(data);
      } else {
        var err = data.rsp.err;
        console.log('Request failure (' + err.code + '): ' + err.msg);
        failure(data);
      }
    };

    // Send request to server
    console.log('Sending request: ' + params.method);
    $.ajax({
      'url': url,
      'dataType': 'jsonp',
      'jsonp': false,
      'cache': true,  // Avoid adding the timestampt to the request
    });
  }

  /**
   * Generates API request signature to be used as api_sig parameter
   *
   * @param {object} params Parameters to used in the signature generation
   * @returns {string} Signature as described in API documentation
   */
  function getSignature(params) {
    var paramsSorted;
    var paramsString;
    paramsSorted = _.pairs(params).sort();
    paramsString = _.flatten(paramsSorted).join('');
    return md5(sharedSecret + paramsString);
  }

  function getEncodedParams(params) {
    return ('?' +
        _.map(_.pairs(params), function(pair) {
          return (pair[0] + '=' + encodeURIComponent(pair[1]));
        }).join('&'));
  }

  /**
   * Gets frob using rtm.auth.getFrob API method
   *
   * @param {object} params Parameters to use in the API request
   * @param {function} success Callback to be executed on successful response
   * @param {function} failure Callback to be executed on failed response
   * @returns {null}
   */
  this.getFrob = function getFrob(success, failure) {
    var params = {
      'method': 'rtm.auth.getFrob',
    };
    sendRequest(params, success, failure);
  };

  /**
   * Gets authorization token using rtm.auth.getToken API method
   *
   * @param {string} frob frob generated using rtm.auth.getFrob
   * @param {function} success Callback to be executed on successful response
   * @param {function} failure Callback to be executed on failed response
   * @returns {null}
   */
  this.getToken = function getToken(frob, success, failure) {
    var params = {
      'method': 'rtm.auth.getToken',
      'frob': frob,
    };
    sendRequest(params, success, failure);
  };

  /**
   * Checks if token is valid using rtm.auth.checkToken API method
   *
   * @param {string} authToken Authorization token generated using rm.auth.getToken
   * @param {function} success Callback to be executed on successful response
   * @param {function} failure Callback to be executed on failed response
   * @returns {null}
   */
  this.checkToken = function checkToken(authToken, success, failure) {
    var params = {
      'method': 'rtm.auth.checkToken',
      'auth_token': authToken,
    };
    sendRequest(params, success, failure);
  };

  /**
   * Returns URL to authorize the application to use RememberTheMilk
   *
   * @param {string} frob frob generated using rtm.auth.getFrob
   * @returns {string} Authorization URL
   */
  this.getAuthUrl = function getAuthUrl(frob) {
    params = {
      'api_key': apiKey,
      'perms': 'delete',
      'frob': frob,
    };

    params.api_sig = getSignature(params);
    return authUrl + getEncodedParams(params);
  };
}

/**
 * Creates an instance of an ApplicationModel object
 *
 * @constructor
 * @this {ApplicationModel}
 * @param {string} apiKey The API key as given by RememberTheMilk
 * @param {string} sharedSecret The shared secret as given by RememberTheMilk
 * @returns {ApplicationModel} The new ApplicationModel object
 */
function ApplicationModel(apiKey, sharedSecret) {
  var self = this;
  var rtm = new RTM(apiKey, sharedSecret);
  var authToken = localStorage.getItem('authToken');
  console.log('authToken: ' + authToken);

  if (authToken) {
    rtm.checkToken(authToken,
        function(data) {
          console.log('Valid token!');
        },
        function(data) {
          console.log('Invalid token!');
          localStorage.removeItem('autToken');
          token = null;
        });
  } else {
    rtm.getFrob(function(data) {
      var frob = data.rsp.frob;
      var authUrl = rtm.getAuthUrl(frob);

      // Enable authorization link
      $('a').attr('href', authUrl);

      // Check user has authorized application
      intervalId = setInterval(function() {
        rtm.getToken(frob, function(data) {
          authToken = data.rsp.auth.token;
          localStorage.setItem('authToken', authToken);
          console.log('authToken: ' + authToken);
          clearInterval(intervalId);
        });},
        5000);
    });
  }
}

