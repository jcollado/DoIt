$(document).ready(function() {
  var apiKey = '66e5ba4e61579ba289e6b8b7b0ac5520';
  var sharedSecret = '1d1cc8bfab1db680';
  var app = new ApplicationModel(apiKey, sharedSecret);
  ko.applyBindings(app);
});

function RTM(apiKey, sharedSecret) {
  var authUrl = 'http://www.rememberthemilk.com/services/auth/';
  var restUrl = 'http://api.rememberthemilk.com/services/rest/';
  var callbackName = 'rtmApiCallback';
  var paramsDefaults = {
    'api_key': apiKey,
    'format': 'json',
    'callback': callbackName,
  };

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

  this.getFrob = function(success, failure) {
    var params = {
      'method': 'rtm.auth.getFrob',
    };
    sendRequest(params, success, failure);
  };

  this.getToken = function(frob, success, failure) {
    var params = {
      'method': 'rtm.auth.getToken',
      'frob': frob,
    };
    sendRequest(params, success, failure);
  };

  this.checkToken = function(authToken, success, failure) {
    var params = {
      'method': 'rtm.auth.checkToken',
      'auth_token': authToken,
    };
    sendRequest(params, success, failure);
  };

  this.getAuthUrl = function(frob) {
    params = {
      'api_key': apiKey,
      'perms': 'delete',
      'frob': frob,
    };

    params.api_sig = getSignature(params);
    return authUrl + getEncodedParams(params);
  };
}

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

