/**
 * Creates objects needed for the application to run
 */
$(document).ready(function onReady() {
  var apiKey = '66e5ba4e61579ba289e6b8b7b0ac5520';
  var sharedSecret = '1d1cc8bfab1db680';
  var rtm = new RTM(apiKey, sharedSecret);
  var app = new ApplicationModel(rtm);
  ko.applyBindings(app);
  app.authorize();
});

/**
 * Creates an instance of a RememberTheMilk API object
 *
 * @constructor
 * @this {RTM}
 * @param {string} apiKey - The API key as given by RememberTheMilk
 * @param {string} sharedSecret - The shared secret as given by RememberTheMilk
 * @returns {RTM} The new RTM object
 */
function RTM(apiKey, sharedSecret) {
  var authUrl = 'http://www.rememberthemilk.com/services/auth/';
  var restUrl = 'http://api.rememberthemilk.com/services/rest/';
  var paramsDefaults = {
    'api_key': apiKey,
    'format': 'json',
  };

  /**
   * Sends API request with parameters to API service
   *
   * @param {object} params - Parameters to use in the API request
   * @param {function} success - Callback to be executed on successful response
   * @param {function} failure - Callback to be executed on failed response
   */
  function sendRequest(params, success, failure) {
    var url;

    // Add timestamp to make sure every request has its own callback
    var callbackName = 'rtmApiCallback' + $.now();

    // Callback are set to empty functions by default
    success = success || $.noop;
    failure = failure || $.noop;

    _.extend(params, paramsDefaults, {'callback': callbackName});
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

      // Remove temporary callback from environment
      delete window[callbackName];
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
   * @param {object} params - Parameters to used in the signature generation
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

  this.auth = {
    /**
     * Gets frob using rtm.auth.getFrob API method
     *
     * @param {object} params - Parameters to use in the API request
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'getFrob': function getFrob(success, failure) {
      var params = {
        'method': 'rtm.auth.getFrob',
      };
      sendRequest(params, success, failure);
    },

    /**
     * Gets authorization token using rtm.auth.getToken API method
     *
     * @param {string} frob - frob generated using rtm.auth.getFrob
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'getToken': function getToken(frob, success, failure) {
      var params = {
        'method': 'rtm.auth.getToken',
        'frob': frob,
      };
      sendRequest(params, success, failure);
    },

    /**
     * Checks if token is valid using rtm.auth.checkToken API method
     *
     * @param {string} authToken - Authorization token generated using rm.auth.getToken
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'checkToken': function checkToken(authToken, success, failure) {
      var params = {
        'method': 'rtm.auth.checkToken',
        'auth_token': authToken,
      };
      sendRequest(params, success, failure);
    },

    /**
     * Returns URL to authorize the application to use RememberTheMilk
     *
     * @param {string} frob - frob generated using rtm.auth.getFrob
     * @returns {string} Authorization URL
     */
    'getUrl': function getUrl(frob) {
      params = {
        'api_key': apiKey,
        'perms': 'delete',
        'frob': frob,
      };

      params.api_sig = getSignature(params);
      return authUrl + getEncodedParams(params);
    }
  };
}

/**
 * Creates an instance of an ApplicationModel object
 *
 * @constructor
 * @this {ApplicationModel}
 * @param {RTM} rtm - RememberTheMilk API object
 * @returns {ApplicationModel} The new ApplicationModel object
 */
function ApplicationModel(rtm) {
  var self = this;

  /*
   * Application state
   *
   * connecting: Checking credentials against RememberTheMilk
   * connected: Authorization link available
   * authorizing: User clicked on authorization link
   * authorized: Authorization token obtained
   */
  this.state = ko.observable("connecting");
  $('a').click(function() {
    self.state("authorizing");
  });


  /**
   * Gets authorization token from localStorage
   * @returns {string} Authorization token
   * */
  function getAuthToken() {
    return localStorage.getItem('authToken');
  }

  /**
   * Sets authorization token into localStorage
   *
   * @param {string} value - Authorization token obtained from API
   */
  function setAuthToken(value) {
    localStorage.setItem('authToken', value);
  }

  /**
   * Get new authorization token from RememberTheMilk API
   */
  function getNewAuthToken() {
    rtm.auth.getFrob(function(data) {
      var frob = data.rsp.frob;
      var authUrl = rtm.auth.getUrl(frob);

      // Enable authorization link
      $('a').attr('href', authUrl);
      self.state('connected');

      // Check user has authorized application
      intervalId = setInterval(function() {
        rtm.auth.getToken(frob, function(data) {
          var authToken = data.rsp.auth.token;
          console.log('authToken: ' + authToken);
          setAuthToken(authToken);
          clearInterval(intervalId);
          self.state('authorized');
        });},
        5000);
    });
  }

  /**
   * Authorize application to use the RememberTheMilk API
   */
  this.authorize = function authorize() {
    var authToken = getAuthToken();

    if (authToken) {
      rtm.auth.checkToken(authToken,
        function(data) {
          console.log('Valid token!');
          self.state('authorized');
        },
        function(data) {
          console.log('Invalid token!');
          getNewAuthToken();
        });
    } else {
      getNewAuthToken();
    }
  };
}

