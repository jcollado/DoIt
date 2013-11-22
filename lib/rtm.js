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
  var restUrl = 'https://api.rememberthemilk.com/services/rest/';
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
    var paramsString = _.map(params, function(value, key) {
      return key + value;
    }).sort().join('');
    return md5(sharedSecret + paramsString);
  }

  function getEncodedParams(params) {
    return ('?' +
        _.map(params, function(value, key) {
          return (key + '=' + encodeURIComponent(value));
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
        'method': 'rtm.auth.getFrob'
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
        'frob': frob
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
        'auth_token': authToken
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
        'frob': frob
      };

      params.api_sig = getSignature(params);
      return authUrl + getEncodedParams(params);
    }
  };

  this.lists = {
    /**
     * Get a list of lists
     *
     * @param {string} authToken - Authentication token obtained from the API
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'getList': function getList(authToken, success, failure) {
      var params = {
        'method': 'rtm.lists.getList',
        'auth_token': authToken
      };
      sendRequest(params, success, failure);
    }
  };

  this.tasks = {
    /**
     * Add a new task to a list
     *
     * @param {string} authToken - Authentication token obtained from the API
     * @param {string} listId - ID for the list to add the task to
     * @param {string} name - Name for the new task to be added
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     *
     */
    'add': function add(authToken, timeline, listId, name, success, failure) {
      var params = {
        'method': 'rtm.tasks.add',
        'auth_token': authToken,
        'timeline': timeline,
        'list_id': listId,
        'name': name,
        'parse': true
      };
      sendRequest(params, success, failure);
    },

    /**
     * Complete a task
     *
     * @param {string} authToken - Authentication token obtained from the API
     * @param {string} timeline - Timeline as obtained through the API
     * @param {string} listId - ID for the list to get tasks from
     * @param {string} taskSeriesId - ID for the task series that contains a task
     * @param {string} taskId - ID for the task to delete
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'complete': function complete(authToken, timeline, listId, taskSeriesId, taskId, success, failure) {
      var params = {
        'method': 'rtm.tasks.complete',
        'auth_token': authToken,
        'timeline': timeline,
        'list_id': listId,
        'taskseries_id': taskSeriesId,
        'task_id': taskId
      };
      sendRequest(params, success, failure);
    },

    /**
     * Delete a task
     *
     * @param {string} authToken - Authentication token obtained from the API
     * @param {string} timeline - Timeline as obtained through the API
     * @param {string} listId - ID for the list to get tasks from
     * @param {string} taskSeriesId - ID for the task series that contains a task
     * @param {string} taskId - ID for the task to delete
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'remove': function remove(authToken, timeline, listId, taskSeriesId, taskId, success, failure) {
      var params = {
        'method': 'rtm.tasks.delete',
        'auth_token': authToken,
        'timeline': timeline,
        'list_id': listId,
        'taskseries_id': taskSeriesId,
        'task_id': taskId
      };
      sendRequest(params, success, failure);
    },

    /**
     * Get a list of tasks
     *
     * @param {string} authToken - Authentication token obtained from the API
     * @param {string} listId - ID for the list to get tasks from
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'getList': function getList(authToken, listId, success, failure) {
      var params = {
        'method': 'rtm.tasks.getList',
        'auth_token': authToken,
        'list_id': listId,
        'filter': 'status: incomplete'
      };
      sendRequest(params, success, failure);
    }
  };

  this.timelines = {
    /**
     * Create a new timeline
     *
     * @param {string} authToken - Authentication token obtained from the API
     * @param {function} success - Callback to be executed on successful response
     * @param {function} failure - Callback to be executed on failed response
     */
    'create': function create(authToken, success, failure) {
      var params = {
        'method': 'rtm.timelines.create',
        'auth_token': authToken
      };
      sendRequest(params, success, failure);
    }
  };
}
