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
}

/**
 * Creates an instance of a ListModel object
 * @param {object} data - Data object obtained through the API
 * @returns {ListModel} The new ListModel object
 */
function ListModel(data) {
  var self = this;
  var booleanProperties = ['archived', 'deleted'];

  this.selected = ko.observable(false);

  // Assign each property in the data to the model object
  _.each(data, function(value, key) {
    if (_.has(self, key)) {
      throw 'Property name overlapping: ' + key;
    }

    if (_.contains(booleanProperties, key)) {
      value = Boolean(parseInt(self[value], 10));
    }
    self[key] = value;
  });
}

/** Created an instance of  TaskSeriesModel object
 * @param {object} data - DAta object obtained through the API
 * @returns {TaskSeriesModel} The new TaskSeriesModel object
 */
function TaskSeriesModel(data) {
  var self = this;

  // Assign each property in the data to the model object
  _.each(data, function(value, key) {
    if (_.has(self, key)) {
      throw 'Property name overlapping: ' + key;
    }

    self[key] = value;
  });
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
   * loading-lists: Loading lists
   * loading-tasks: Loading tasks
   * ready: Waiting for user events
   */
  this.state = ko.observable('connecting');
  $('a').click(function() {
    self.state('authorizing');
  });

  this.lists = ko.observableArray();
  this.selectedLists = ko.computed(function() {
    var selectedLists = _.filter(self.lists(), function(list) {
        return list.selected();
      });
    console.log('Selected lists:', selectedLists);
    return selectedLists;
  });
  this.taskSeries = ko.observableArray();

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
          authorized();
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
          authorized();
        },
        function(data) {
          console.log('Invalid token!');
          getNewAuthToken();
        });
    } else {
      getNewAuthToken();
    }
  };

  /**
   * Updates application state and load lists
   */
  function authorized() {
    self.state('loading-lists');

    rtm.lists.getList(getAuthToken(), function(data) {
      var rawArray = self.lists();

      // Create array a lists
      var lists = _.map(data.rsp.lists.list, function(data) {
        return new ListModel(data);
      });

      ko.utils.arrayPushAll(rawArray, lists);
      rawArray.sort(function(left, right) {
        if (left.name < right.name) {
          return -1;
        }

        if (left.name > right.name) {
          return 1;
        }

        return 0;
      });

      self.lists.valueHasMutated();
      self.state('ready');
    });
  }

  /**
   * Select list to display its tasks
   *
   * @param {List} list - List to be selected
   */
  this.selectList = function selectList(list) {
    // When lists array is populated, 'clicked' events are generated for an
    // unknown reason. To discard those events, the application state is checked
    if (self.state() == 'ready') {
      var authToken = getAuthToken();

      // Deselect previously selected lists (should be only one)
      _.each(self.selectedLists(), function(list) {
        list.selected(false);
      });
      list.selected(true);

      self.state('loading-tasks');
      self.taskSeries.removeAll();

      rtm.tasks.getList(authToken, list.id, function(data) {
        var tasks = data.rsp.tasks;
        var list;
        var rawArray;
        var taskSeries;

        if (!_.has(tasks, 'list')) {
          self.state('ready');
          return;
        }

        lists = tasks.list;

        // RememberTheMilk returns an array of lists or an object if there's
        // only one list in the results.
        if (!_.isArray(lists)) {
          lists = [lists];
        }
        taskSeries = _.chain(lists)
          .map(
            function(list) {
              var taskSeries = list.taskseries;

              // RememberTheMilk returns an array of task series or an object
              // if there's only one task series in the results
              if (!_.isArray(taskSeries)) {
                taskSeries = [taskSeries];
              }

              return taskSeries;
            })
          .flatten()
          .map(
              function(data) {
                return new TaskSeriesModel(data);
              })
          .value();

        rawArray = self.taskSeries();
        ko.utils.arrayPushAll(rawArray, taskSeries);
        self.taskSeries.valueHasMutated();
        self.state('ready');
      });
    }
  };


  /**
   * Return whether application is in an authorized status or not
   *
   * @returns {boolean} true if state is any of the authorized ones
   */
  this.isAuthorized = function isAuthorized() {
    return _.contains(
        ['ready', 'loading-lists', 'loading-tasks'],
        self.state());
  };

  /**
   * Select task to display its details
   *
   * @param {object} taskseries - Task series as returned by the Remember The Milk API
   */
  this.selectTask = function selectTask(task) {
    if (self.state() == 'ready') {
      console.log('Selected task:', task);
    }
  };
}

