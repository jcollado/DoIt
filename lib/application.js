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

    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var $element = $(element);
      var value = ko.unwrap(valueAccessor());

      // Make sure animation methods are only called when needed
      if (($element.is(':visible') && value) || ($element.is(':hidden') && !value)) {
        return;
      }

      if (value) {
        $element.slideDown();
      } else {
        $element.slideUp(function() {
          if (allBindings.has('afterSlideUp')) {
            var callback = allBindings.get('afterSlideUp');
            callback(bindingContext.$data);
          }
        });
      }
    }
};

/**
 * Adds new 'hover' binding
 * Sets the vale of the given observable based on mouseenter/mouseleave events
 */
ko.bindingHandlers.hover = {
    init: function(element, valueAccessor) {
      $(element).hover(
          function() {
            var value = valueAccessor();
            value(true);
          },
          function() {
            var value = valueAccessor();
            value(false);
          }
      );
    }
};

/**
 * Creates an instance of a ListModel object
 * @param {object} data - Data object obtained through the API
 * @returns {ListModel} The new ListModel object
 */
function ListModel(app, data) {
  var self = this;
  var _self = _(this);
  var booleanProperties = _(['archived', 'deleted']);

  /**
   * List should be displayed
   *
   * This is useful to apply the slide effect on addition removal
   */
  this.display = ko.observable();

  /**
   * This list has been selected by the user
   */
  this.selected = ko.observable(false);

  /**
   * Waiting response to an API request
   */
  this.waitingForResponse = ko.observable(false);

  /**
   * Mouse hovering around
   */
  this.hover = ko.observable(false);

  /**
   * Display actions (edit, remove)
   */
  this.displayActions = ko.computed(function() {
    return self.hover() && !self.waitingForResponse();
  });


  /**
   * Edit this list
   */
  this.edit = function edit(data) {
    console.log('Edit list:', data);
  };

  /**
   * Delete this list (backend)
   */
  this.remove = function remove(list) {
    var authToken = app.getAuthToken();
    self.waitingForResponse(true);

    app.rtm.timelines.create(authToken, function(data) {
      var timeline = data.rsp.timeline;

      app.rtm.lists.remove(
        authToken,
        timeline,
        list.id,
        function() {
          self.display(false);
        }
      );
    });
  };

  /*
   * Delete this list (frontend)
   *
   * This will be called after response from API has been received and slideUp
   * animation has finished.
   */
  this.afterRemove = function afterRemove(list) {
    app.taskSeries.removeAll();
    app.lists.remove(list);
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

  // List is displayed also based on its archived and deleted status
  this.display(!(this.archived || this.deleted));
}

/** Created an instance of  TaskSeriesModel object
 * @param {object} data - Data object obtained through the API
 * @param {boolean) display - Display object (useful when an animation is preferred)
 * @returns {TaskSeriesModel} The new TaskSeriesModel object
 */
function TaskSeriesModel(app, data) {
  var self = this;
  var _self = _(self);

  var tags;
  var priorityMap = {
    'N': 'No priority set',
    '1': 'Low',
    '2': 'Medium',
    '3': 'High'
  };

  /**
   * Task should be displayed
   *
   * This is useful to apply the slide effect on addition removal
   */
  this.display = ko.observable(true);

  /**
   * Task has been selected
   */
  this.selected = ko.observable(false);

  /**
   * Waiting response to an API request
   */
  this.waitingForResponse = ko.observable(false);

  /**
   * Mouse hovering around
   */
  this.hover = ko.observable(false);

  /**
   * Display actions (edit, remove)
   */
  this.displayActions = ko.computed(function() {
    return self.hover() && !self.waitingForResponse();
  });

  /**
   * Edit this task series name
   */
  this.edit = function edit(data) {
    console.log('Edit task series:', data);
  };

  /**
   * Complete this task
   */
  this.complete = function complete(taskSeries) {
    var authToken = app.getAuthToken();
    self.waitingForResponse(true);

    app.rtm.timelines.create(authToken, function(data) {
      var timeline = data.rsp.timeline;

      app.rtm.tasks.complete(
        authToken,
        timeline,
        app.selectedList().id,
        taskSeries.id,
        taskSeries.task.id,
        function() {
          self.display(false);
        }
      );
    });
  };

  /**
   * Delete this task series (backend)
   */
  this.remove = function remove(taskSeries) {
    var authToken = app.getAuthToken();
    self.waitingForResponse(true);

    app.rtm.timelines.create(authToken, function(data) {
      var timeline = data.rsp.timeline;

      app.rtm.tasks.remove(
        authToken,
        timeline,
        app.selectedList().id,
        taskSeries.id,
        taskSeries.task.id,
        function() {
          self.display(false);
        }
      );
    });
  };

  /*
   * Delete this task series (frontend)
   *
   * This will be called after response from API has been received and slideUp
   * animation has finished.
   */
  this.afterRemove = function afterRemove(taskSeries) {
    app.taskSeries.remove(taskSeries);
  };

  // Assign each property in the data to the model object
  _.each(data, function(value, key) {
    if (_self.has(key)) {
      throw 'Property name overlapping: ' + key;
    }

    self[key] = value;
  });

  tags = this.tags.tag;
  if (_.isArray(tags)) {
    this.tags = tags;
  } else if (_.isUndefined(tags)) {
    this.tags = [];
  } else {
    this.tags = [tags];
  }

  this.task.priority = priorityMap[this.task.priority];
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
  this.rtm = rtm;

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
  this.sortedLists = ko.computed(function() {
    return _.sortBy(self.lists(), 'name');
  });

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
  this.getAuthToken = function getAuthToken() {
    return localStorage.getItem('authToken');
  };

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
    var authToken = self.getAuthToken();

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

    rtm.lists.getList(self.getAuthToken(), function(data) {
      var rawArray = self.lists();

      // Create array a lists
      var lists = _.map(data.rsp.lists.list, function(data) {
        return new ListModel(self, data);
      });

      ko.utils.arrayPushAll(rawArray, lists);
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
      var authToken = self.getAuthToken();

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
                return new TaskSeriesModel(self, data);
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
   * List is being added
   *
   * This is useful to display a spinner while waiting for the operation to
   * complete.
   */
  this.addingList = ko.observable(false);

  /**
   * Add list
   */
  this.addList = function addList() {
    var authToken = self.getAuthToken();
    self.addingList(true);

    rtm.timelines.create(authToken, function(data) {
      var timeline = data.rsp.timeline;

      rtm.lists.add(
        authToken,
        timeline,
        self.newListName(),
        function(data) {
          var newListData = data.rsp.list;
          var newList = new ListModel(self, newListData);

          // Don't show new list at once, but slide smoothly
          newList.display(false);
          self.lists.push(newList);
          newList.display(true);

          self.newListName(null);
          self.addingList(false);
      });
    });
  };

  /**
   * Toggle task selection to display its details
   *
   * @param {object} task - Task series as returned by the Remember The Milk API
   */
  this.toggleTask = function toggleTask(task) {
    if (self.state() == 'ready' && task.display()) {
      console.log('Toggled task:', task);
      task.selected(!task.selected());
    }
  };

  /**
   * Task is being added
   *
   * This is useful to display a spinner while waiting for the operation to
   * complete.
   */
  this.addingTask = ko.observable(false);

  /**
   * Add task
   */
  this.addTask = function addTask() {
    var authToken = self.getAuthToken();
    self.addingTask(true);

    rtm.timelines.create(authToken, function(data) {
      var timeline = data.rsp.timeline;

      rtm.tasks.add(
        authToken,
        timeline,
        self.selectedList().id,
        self.newTaskName(),
        function(data) {
          var newTaskData = data.rsp.list.taskseries;
          var newTask = new TaskSeriesModel(self, newTaskData);

          // Don't show new task at once, but slide smoothly
          newTask.display(false);
          self.taskSeries.push(newTask);
          newTask.display(true);

          self.newTaskName(null);
          self.addingTask(false);
      });
    });
  };
}

