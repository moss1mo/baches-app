// Ionic cordovapl App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'cordovapl' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('bachesapp', ['ionic', 'bachesapp.controllers', 'bachesapp.services',
'ngLodash', 'ngCordova', 'uiGmapgoogle-maps', 'angularMoment'])
.constant("cordovaplConfig", {
    //"restUrl": "http://ec2-52-38-248-67.us-west-2.compute.amazonaws.com:3000",
    //"staticUrl": "http://ec2-52-38-248-67.us-west-2.compute.amazonaws.com:3000",
    //"restUrl": "http://192.168.56.1:3000", //genymotion alone
    //"staticUrl": "http://192.168.56.1:3000", //genymotion alone
    
    "restUrl": "http://ec2-52-38-185-118.us-west-2.compute.amazonaws.com:8080",
    //"restUrl": "http://192.168.1.66:3000",
    "staticUrl": "http://ec2-52-38-185-118.us-west-2.compute.amazonaws.com:8080",
    //"staticUrl": "http://192.168.1.66:3000",
    //"restUrl": "https://nameless-tundra-8132.herokuapp.com",
    //"staticUrl": "https://nameless-tundra-8132.herokuapp.com",
    "ANDROID_AD_ID": 'ca-app-pub-6878356611909788/4048898954',
    "IOS_AD_ID": 'ca-app-pub-6878356611909788/4048898954',
    "CITY_CENTER": {title: 'Lat: 19.4326018 / Lng: -99.1332049', lat: 19.4326018, lng: -99.1332049},
    "DEFAULT_PHOTO": 'file:///android_asset/www/img/incident.png',
    "AREAS": undefined,
    "MEXICO_BOUNDS_DATA": [{
      name: 'México', sw_latitude: 13.414255000000000, sw_longitude: -118.858263000000000,
      ne_latitude: 33.250679000000000, ne_longitude: -86.734243000000000
    }]
})
.config(function(uiGmapGoogleMapApiProvider) {
  uiGmapGoogleMapApiProvider.configure({
    //key: 'AIzaSyAOFjTia1n5IjP86a62PCFnWj1DAEXqG-k',
    key: 'AIzaSyC9_qEoKX2LD5AmHi2wNs3RTu3PqQTgLDQ',
    v: '3.24' //defaults to latest 3.X anyhow
    //libraries: 'weather,geometry,visualization'
  });
})
.run(function($ionicPlatform, $rootScope, $cordovaGeolocation, lodash, cordovaplConfig,
  $cordovaSQLite, $ionicScrollDelegate, amMoment) {
  amMoment.changeLocale('es');
  $ionicPlatform.ready(function() {
    $ionicPlatform.registerBackButtonAction(function (event) {
      event.preventDefault();
    }, 100);

    //http://forum.ionicframework.com/t/ionic-geolocation-woes/2471/13?u=gajotres
    /*
    document.addEventListener("deviceready", function() {
      navigator.geolocation.getCurrentPosition(function(position) {
        console.log({lat: position.coords.latitude, lng: position.coords.longitude});
      }, function(err) {
        console.log('Error in GPS: ' + JSON.stringify(err));
      }, { timeout: 15000 });
    }, false);
    */

    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      //https://forum.ionicframework.com/t/select-dropdown-issue-on-ios/5573/4
      if (ionic.Platform.isIOS()) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(false);
      } else {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      }

      cordova.plugins.Keyboard.disableScroll(true);
    }

    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleLightContent();
    }

    $rootScope.$on('$stateChangeSuccess', function() {
      $ionicScrollDelegate.scrollTop();
    });

    var db = undefined;
    var getDb = function() {
      if (db == undefined) {
        if (window.cordova   && window.SQLitePlugin) {
          db = $cordovaSQLite.openDB({ name: "bachesapp.db", location: "default"});
        } else {
          db = window.openDatabase("bachesapp.db", "1.0", "Dev Database", 10000);
        }
      }
      return db;
    }

    console.log('create tables');
    //$cordovaSQLite.execute(getDb(), "DROP TABLE submit_incidents");
    $cordovaSQLite.execute(getDb(), "CREATE TABLE IF NOT EXISTS submit_incidents " +
      "(supervisor_id varchar not null, offline_id varchar not null, json_str varchar not null)"
    );

    //$cordovaSQLite.execute(getDb(), "DROP TABLE change_incident_statuses");
    $cordovaSQLite.execute(getDb(), "CREATE TABLE IF NOT EXISTS change_incident_statuses " +
      "(supervisor_id varchar not null, cluster_id varchar not null, status integer not null, " +
      "photo_loc varchar not null, changed_ts integer not null, json_str varchar not null)"
    );
    console.log('tables created');

    facebookConnectPlugin.activateApp(function() {
      console.log('activation notified to fb');
    }, function () {
      console.log('activation not notified to fb');
    });
  });
})

.config(function($ionicConfigProvider) {
  $ionicConfigProvider.tabs.position('bottom');
})

.config(function($stateProvider, $urlRouterProvider) {
  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider

  .state('login', {
    url: '/login',
    templateUrl: 'templates/login.html',
    controller: 'LoginCtrl'
  })

  // setup an abstract state for the tabs directive
  .state('tab', {
    url: '/tab',
    abstract: true,
    templateUrl: 'templates/tabs.html',

    controller: function($scope, user, $ionicNavBarDelegate) {
      $ionicNavBarDelegate.showBackButton(false);
      $scope.userDetail = user.authData.userDetail;
    },

    resolve: {
      aunthenticate: function authenticate($q, $state, $timeout, user) {
        return $q(function(resolve, reject) {
          if (user.isAuthenticated()) {
            resolve(true);
          } else {
            $timeout(function() {
              $state.go('login');
            });

            reject(false);
          }
        });
      }
    }
  })

  // Each tab has its own nav history stack:

  .state('tab.report-incident', {
    url: '/report-incident',
    abstract: true,
    views: {
      'tab.report-incident': {
        template: '<ion-nav-view></ion-nav-view>',
        controller: 'ReportIncidentCtrl',
      }
    }
  })

  .state('tab.report-incident.map', {
    url: '',
    templateUrl: 'templates/tab.report-incident.map.html',
    controller: 'ReportIncidentMapCtrl',
    resolve: {
      areas: function areas($q, $state, $timeout, $http, cordovaplConfig) {
        if (cordovaplConfig.AREAS != undefined) {
          return $q.when(cordovaplConfig.AREAS);
        } else {
          return $http.get(cordovaplConfig.restUrl + '/api/areas', {
            timeout: 10000,
            cache: false
          }).then(function(res) {
            if (res.data == undefined) {
              cordovaplConfig.AREAS = cordovaplConfig.MEXICO_BOUNDS_DATA;
            } else {
              cordovaplConfig.AREAS = res.data;
            }
            return cordovaplConfig.AREAS;
          }, function(err) {
            cordovaplConfig.AREAS = cordovaplConfig.MEXICO_BOUNDS_DATA;
            return cordovaplConfig.AREAS;
          });
        }
      }
    }
  })

  .state('tab.report-incident.success', {
    templateUrl: 'templates/tab.report-incident.success.html',
    url: '/report-incident.success?lat&lng',
    controller: 'ReportIncidentSuccessCtrl'
  })

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/tab/report-incident');

});
