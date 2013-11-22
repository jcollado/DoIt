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
 * Adds new 'slide' binding
 * This works as the 'visible' binding, but with a slide animation.
 */
ko.bindingHandlers.slide = {
    init: function(element, valueAccessor) {
        var value = ko.unwrap(valueAccessor());
        $(element).toggle(value);
    },

    update: function(element, valueAccessor) {
        var value = ko.unwrap(valueAccessor());
        if (value) {
            $(element).slideDown();
        } else {
            $(element).slideUp();
        }
    }
};

/**
 * Creates an instance of a ListModel object
 * @param {object} data - Data object obtained through the API
 * @returns {ListModel} The new ListModel object
 */
function ListModel(data) {
  var self = this;
  var _self = _(this);
  var booleanProperties = _(['archived', 'deleted']);

  this.selected = ko.observable(false);

  /**
   * Display list actions (edit, remove)
   */
  this.displayListActions = ko.observable(false);

  /**
   * Toggle display list actions on hover
   */
  this.toggleDisplayListActions = function toggleDisplayListActions() {
    self.displayListActions(!self.displayListActions());
  };

  /**
   * Edit this list
   */
  this.edit = function edit(data) {
    console.log('Edit list:', data);
  };

  /**
   * Delete this list
   */
  this.remove = function remove(data) {
    console.log('Remove list:', data);
  };

  // Assign each property in the data to the model object
  _.each(data, function(value, key) {
    if (_self.has(key)) {
      throw 'Property name overlapping: ' + key;
    }

    if (booleanProperties.contains(key)) {
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
  var _self = _(self);
  var tags;

  /**
   * Task has been selected
   */
  this.selected = ko.observable(false);

  /**
   * Display task actions (edit, remove)
   */
  this.displayTaskActions = ko.observable(false);

  /**
   * Toggle display task actions on hover
   */
  this.toggleDisplayTaskActions = function toggleDisplayTaskActions() {
    self.displayTaskActions(!self.displayTaskActions());
  };

  /**
   * Complete this task
   */
  this.complete = function complete(data) {
    console.log('Complete task series:', data);
  };

  /**
   * Edit this task series name
   */
  this.edit = function edit(data) {
    console.log('Edit task series:', data);
  };

  /**
   * Delete this task series
   */
  this.remove = function remove(data) {
    console.log('Remove task series:', data);
  };

  // Assign each property in the data to the model object
  _.each(data, function(value, key) {
    if (_self.has(key)) {
      throw 'Property name overlapping: ' + key;
    }

    self[key] = value;
  });

  tags = self.tags.tag;
  if (_.isArray(tags)) {
    self.tags = tags;
  } else if (_.isUndefined(tags)) {
    self.tags = [];
  } else {
    self.tags = [tags];
  }
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

  /*
   * Authorization URL
   *
   * Used to refer the user to the Remember The Milk authorization page
   */
  this.authUrl = ko.observable();

  /*
   * Task lists as received from the API
   */
  this.lists = ko.observableArray();

  /*
   * Selected list (if any)
   */
  this.selectedList = ko.computed(function() {
    var selectedList = _.find(
      self.lists(),
      function(list) {
        return list.selected();
      });
    console.log('Selected list:', selectedList);
    return selectedList;
  });

  /*
   * Task series for the selected lists
   */
  this.taskSeries = ko.observableArray();

  /*
   * New list name entered by the user
   */
  this.newListName = ko.observable();

  /*
   * New task name entered by the user
   */
  this.newTaskName = ko.observable();

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

      // Enable authorization link
      self.authUrl(rtm.auth.getUrl(frob));
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
   * Update state to authorizing
   * @returns {Boolean} Always true to make sure default handler is called
   */
  this.authorizing = function authorizing() {
    self.state('authorizing');

    /* Default handler called, that is, link href is followed */
    return true;
  };

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
   * Select list to display its tasks
   *
   * @param {List} list - List to be selected
   */
  this.selectList = function selectList(list) {
    // When lists array is populated, 'clicked' events are generated for an
    // unknown reason. To discard those events, the application state is checked
    if (self.state() == 'ready') {
      var authToken = getAuthToken();

      // Deselect previously selected list
      var selectedList = self.selectedList();
      if (selectedList) {
        selectedList.selected(false);
      }
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
   * Add list
   */
  this.addList = function addList() {
    console.log('Add list ' + self.newListName());
  };

  /**
   * Toggle task selection to display its details
   *
   * @param {object} task - Task series as returned by the Remember The Milk API
   */
  this.toggleTask = function toggleTask(task) {
    if (self.state() == 'ready') {
      console.log('Toggled task:', task);
      task.selected(!task.selected());
    }
  };

  /**
   * Add task
   */
  this.addTask = function addTask() {
    var authToken = getAuthToken();
    console.log(authToken);

    rtm.timelines.create(authToken, function(data) {
      var timeline = data.rsp.timeline;
      console.log(timeline);

      rtm.tasks.add(
        authToken,
        timeline,
        self.selectedList().id,
        self.newTaskName(),
        function(data) {
          var newTaskData = data.rsp.list.taskseries;
          var newTask = new TaskSeriesModel(newTaskData);
          self.taskSeries.push(newTask);
      });
    });
  };
}

