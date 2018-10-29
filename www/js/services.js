angular.module('bachesapp.services', [])

.service('mapSvc', function(uiGmapGoogleMapApi, $timeout, $q) {
  var geocoder = undefined;

  this.getGeocoder = function() {
    if (geocoder != undefined) return $q.when(geocoder);

    return $q(function(resolve, reject) {
      var uiGmapGoogleMapApiTimer = $timeout(function() {
        reject("uiGmapGoogleMapApi didn't respond after 10 seconds.");
      }, 10000);

      uiGmapGoogleMapApi.then(function(maps) {
        $timeout.cancel(uiGmapGoogleMapApiTimer);
        geocoder = new google.maps.Geocoder();
        resolve(geocoder);
      }, function(err) {
        $timeout.cancel(uiGmapGoogleMapApiTimer);
        reject(err);
      });
    });
  };

  this.getGmaps = function() {
    return uiGmapGoogleMapApi.then(function(maps) {
      return maps;
    });
  };
})

.service('user', function(cordovaplConfig, $http, $q, lodash, $window, $timeout, $cordovaToast) {
  var ret = {};

  if ($window.localStorage.authData) {
    try {
      ret.authData = JSON.parse($window.localStorage.authData);
    } catch (exc) {
      console.log('error ' + JSON.stringify(exc));
    }
  }

  var setAuthData = function(authData) {
    ret.authData = authData;
    if (authData) {
      $window.localStorage.authData = JSON.stringify(authData);
    } else {
      $window.localStorage.authData = undefined;
    }
  }

  ret.setAuthData = setAuthData;

  ret.watchAuthenticationStatusChange = function() {

  }

  ret.getAuthData = function() {
    return ret.authData;
  }

  ret.submitRegisterCiudadano = function(userData, fbData) {
    return $http.post(cordovaplConfig.restUrl + '/api/perfil_ciudadano',
      {
        userData: userData,
        fbData: fbData
      }, {
      timeout: 10000
    });
  }

  ret.linkFb = function(fbData) {
    return $http.post(cordovaplConfig.restUrl + '/api/link_fb',
      fbData, {
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: ret.getAuthData().auth_token
      }
    }).then(function(res) {
      setAuthData(res.data);
      return res.data;
    });
  }

  ret.unlinkFb = function() {
    return $http.post(cordovaplConfig.restUrl + '/api/unlink_fb',
      null, {
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: ret.getAuthData().auth_token
      }
    }).then(function(res) {
      setAuthData(res.data);
      return res.data;
    });
  }

  ret.loginCiudadano = function(loginName, password) {
    return this.logout().then(function() {
      return $http.get(cordovaplConfig.restUrl + '/api/perfil_ciudadano', {
        params: {login_name: loginName, password: password},
        timeout: 10000,
        cache: false
      });
    }).then(function(res) {
      setAuthData(res.data);
      return res.data;
    });
  }

  ret.loginSupervisor = function(loginName, password) {
    return this.logout().then(function() {
      return $http.get(cordovaplConfig.restUrl + '/api/perfil_supervisor', {
        params: {login_name: loginName, password: password},
        timeout: 10000,
        cache: false
      });
    }).then(function(res) {
      setAuthData(res.data);
      return res.data;
    });
  }

  ret.logout = function() {
    setAuthData(undefined);
    return $q.when();
  }

  ret.isAuthenticated = function() {
    return (this.authData != undefined);
  }

  //---
  ret.getFacebookProfileInfo = function (authResponse) {
    var info = $q.defer();

    facebookConnectPlugin.api('/me?fields=email,name&access_token=' + authResponse.accessToken, null,
      function (response) {
        info.resolve(response);
      },
      function (err) {
        console.log(err);
        info.reject(err);
      }
    );
    return info.promise;
  };

  ret.logoutFacebook = function(cb) {
    return $q(function(resolve, reject) {
      facebookConnectPlugin.logout(function() {
        cb().then(function(resp) {
          resolve(resp);
        }, function(err) {
          console.log(err);
          reject(err);
        });
      }, function(err) {
        console.log(err);
        cb().then(function(resp) {
          console.log(resp);
          resolve(resp);
        }, function(err) {
          console.log(err);
          reject(err);
        });
      });
    });
  }

  ret.authFacebook = function() {
    return $q(function(resolve, reject) {
      facebookConnectPlugin.login(["email", "public_profile"], function(response) {
        if (!response.authResponse){
          reject({
            code: '1', //1: User cancalled dialog at the first login
            error: "No authResponse"
          });
          return;
        }

        //https://ionicthemes.com/tutorials/about/native-facebook-login-with-ionic-framework
        ret.getFacebookProfileInfo(response.authResponse).then(function(profileInfo) {
          var fbCancellerEnabled = true;
          var fbCancelled = false;
          var fbCanceller = $timeout(function() {
            if (fbCancellerEnabled) {
              fbCancelled = true;

              $cordovaToast.showShortCenter('No respuesta de Facebook');
              reject({
                code: '6', //5: Permission for publish not granted
                error: undefined
              });
            }
          }, 20000);

          facebookConnectPlugin.login(["publish_actions"], function(response) {
            if (fbCancelled) return;
            //turns out if use click "not now", it will not fail.
            //so we need to make another call if we get the required permissions
            facebookConnectPlugin.api("/me/permissions", [], function(resp) {
              if (fbCancelled) return;
              fbCancellerEnabled = false;
              $timeout.cancel(fbCanceller);

              var publishActionPermission = lodash.find(resp.data, function(permObj) {
                return permObj.permission == "publish_actions" && permObj.status == "granted";
              });

              if (publishActionPermission != undefined) {
                resolve({
                  userData: {
                    email: profileInfo.email,
                    name: profileInfo.name,
                  },
                  fbData: {
                    id: profileInfo.id,
                    accessToken: response.authResponse.accessToken
                  },
                  fbName: profileInfo.name
                });
              } else {
                reject({
                  code: '5', //5: Permission for publish not granted
                  error: undefined
                });
              }
            }, function(err) {
              if (fbCancelled) return;
              fbCancellerEnabled = false;
              $timeout.cancel(fbCanceller);

              reject({
                code: '4', //4: Failed checking if publish permission was given
                error: err
              });
            });
          }, function(error) {
            if (fbCancelled) return;
            fbCancellerEnabled = false;
            $timeout.cancel(fbCanceller);

            console.log(error)
            if (error.errorCode == 4201) {
              reject({
                code: '5', //5: Permission for publish not granted
                error: undefined
              });
            } else {
              reject({
                code: '3', //3: Failed getting publish permission / cancelled dialog
                error: error
              });
            }
          });
        }, function(fail) {
          console.log(fail)
          reject({
            code: '2', //2: Failed getting profile info
            error: fail
          });
        });
      }, function(error) {
        console.log(error)
        reject({
          code: '1', //1: User cancalled dialog at the first login
          error: error
        });
      });
    });
  }
  //-----

  return ret;
})

.service('incidentSvc', function($q, lodash, $window, $http, user, cordovaplConfig,
  $cordovaDevice, $cordovaSQLite, $cordovaFile, $cordovaCamera) {
  var db = undefined;
  var getDb = function() {
    if (window.cordova   && window.SQLitePlugin) {
      db = $cordovaSQLite.openDB({ name: "bachesapp.db", location: "default"});
    } else {
      db = window.openDatabase("bachesapp.db", "1.0", "Dev Database", 10000);
    }
    return db;
  }

  var ret = {};
  var generateUUID = function(){
    return $cordovaDevice.getUUID() + '_' + (new Date()).getTime();
  }

  var materialTypes = undefined;
  ret.getMaterialTypes = function() {
    return $q(function(resolve, reject) {
      if (materialTypes != undefined) {
        resolve(materialTypes);
      } else {
        $http.get(cordovaplConfig.restUrl + '/api/materialTypes', {
          timeout: 10000,
          cache: false,
          headers: {
            Authorization: user.getAuthData().auth_token
          }
        }).then(function(res) {
          materialTypes = res.data;
          resolve(materialTypes);
        }, function(err) {
          resolve(undefined);
        });
      }
    });
  }

  var clusterTypes = undefined;
  ret.getClusterTypes = function() {
    return $q(function(resolve, reject) {
      if (clusterTypes != undefined) {
        resolve(clusterTypes);
      } else {
        $http.get(cordovaplConfig.restUrl + '/api/clusterTypes', {
          timeout: 10000,
          cache: false,
          headers: {
            Authorization: user.getAuthData().auth_token
          }
        }).then(function(res) {
          clusterTypes = res.data;
          resolve(clusterTypes);
        }, function(err) {
          resolve(undefined);
        });
      }
    });
  }

  ret.getReportedClusters = function(bb) {
    return $http.get(cordovaplConfig.restUrl + '/api/clusters/status/reported', {
      params: {
        latMin: bb[0],
        lngMin: bb[1],
        latMax: bb[2],
        lngMax: bb[3]
      },
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      lodash.forEach(res.data.results, function(rec) {
        rec.online = true;
      });

      return res.data.results;
    });
  }

  ret.getVerifiedClusters = function(bb) {
    return $http.get(cordovaplConfig.restUrl + '/api/clusters/status/verified', {
      params: {
        latMin: bb[0],
        lngMin: bb[1],
        latMax: bb[2],
        lngMax: bb[3]
      },
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      lodash.forEach(res.data.results, function(rec) {
        rec.online = true;
      });

      return res.data.results;
    });
  }



  ret.getOnRepairClusters = function(bb) {
    return $http.get(cordovaplConfig.restUrl + '/api/clusters/status/on_repair', {
      params: {
        latMin: bb[0],
        lngMin: bb[1],
        latMax: bb[2],
        lngMax: bb[3]
      },
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      lodash.forEach(res.data.results, function(rec) {
        rec.online = true;
      });

      return res.data.results;
    });
  }

  ret.getRepairedClusters = function(bb) {
    return $http.get(cordovaplConfig.restUrl + '/api/clusters/status/repaired', {
      params: {
        latMin: bb[0],
        lngMin: bb[1],
        latMax: bb[2],
        lngMax: bb[3]
      },
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      lodash.forEach(res.data.results, function(rec) {
        rec.online = true;
      });

      return res.data.results;
    });
  }

  ret.getAssignedClusters = function(bb, supervisorId) {
    return $http.get(cordovaplConfig.restUrl + '/api/supervisors/' + supervisorId + '/clusters', {
      params: {
        latMin: bb[0],
        lngMin: bb[1],
        latMax: bb[2],
        lngMax: bb[3]
      },
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      lodash.forEach(res.data.results, function(rec) {
        rec.online = true;
      });

      return res.data.results;
    });
  }


  ret.getLastAssignedCluster = function(supervisorId) {
    return $http.get(cordovaplConfig.restUrl + '/api/supervisors/' + supervisorId + '/lastCluster', {
      params: {},
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      lodash.forEach(res.data.results, function(rec) {
        rec.online = true;
      });

      return res.data.results[0];
    });
  }

  ret.getOfflineSubmitIncidents = function(supervisorId) {
    var sqlQuery = "SELECT * FROM submit_incidents WHERE supervisor_id = ?";
    return $cordovaSQLite.execute(getDb(), sqlQuery, [supervisorId]).then(function(res) {
      var offlineSubmitIncidents = [];

      for (var i = 0; i < res.rows.length; i++) {
        var reporteIncidente = JSON.parse(res.rows.item(i).json_str);
        reporteIncidente.offline_id = res.rows.item(i).offline_id;

        offlineSubmitIncidents.push(reporteIncidente);
      }

      return offlineSubmitIncidents;
    });
  }

  ret.getOfflineChangeIncidentStatuses = function(supervisorId) {
    var sqlQuery = "SELECT * FROM change_incident_statuses WHERE supervisor_id = ?";
    return $cordovaSQLite.execute(getDb(), sqlQuery, [supervisorId]).then(function(res) {
      var offlineChangeIncidentStatuses = [];

      for (var i = 0; i < res.rows.length; i++) {
        offlineChangeIncidentStatuses.push({
          supervisor_id: res.rows.item(i).supervisor_id,
          cluster_id: res.rows.item(i).cluster_id,
          status: res.rows.item(i).status,
          photo_loc: res.rows.item(i).photo_loc,
          changed_ts: res.rows.item(i).changed_ts,
          original_cluster: JSON.parse(res.rows.item(i).json_str)
        });
      }

      return offlineChangeIncidentStatuses;
    });
  }

  ret.submitOfflineData = function(offlineSubmitIncidents, offlineChangeIncidentStatuses) {
    var submitIncidentOps = lodash.map(offlineSubmitIncidents, function(offlineSubmitIncident) {
      return function(accumulator) {
        return ret.submitIncident(offlineSubmitIncident, true).then(function() {
          return $cordovaSQLite.execute(getDb(), "DELETE FROM submit_incidents WHERE offline_id = ?",
            [offlineSubmitIncident.offline_id]).then(function(res) {
            accumulator.uploadCount += 1;
            return accumulator;
          }, function() {
            accumulator.uploadCount += 1;
            return accumulator;
          });
        }, function() {
          return accumulator;
        });
      }
    });

    var changeIncidentStatusOps = lodash.map(offlineChangeIncidentStatuses, function(offlineChangeIncidentStatus) {
      return function(accumulator) {
        return ret.changeIncidentStatus(offlineChangeIncidentStatus.original_cluster,
          offlineChangeIncidentStatus.photo_loc, offlineChangeIncidentStatus.status,
          offlineChangeIncidentStatus.supervisor_id, offlineChangeIncidentStatus.changed_ts, true
        ).then(function() {
          return $cordovaSQLite.execute(getDb(), "DELETE FROM change_incident_statuses WHERE cluster_id = ?",
            [offlineChangeIncidentStatus.cluster_id]).then(function(res) {
            accumulator.uploadCount += 1;
            return accumulator;
          }, function() {
            accumulator.uploadCount += 1;
            return accumulator;
          });
        }, function() {
          return accumulator;
        });
      };
    });

    var submitOfflineDataOps = submitIncidentOps.concat(changeIncidentStatusOps);
    return lodash.reduce(submitOfflineDataOps, function(soFar, submitOfflineDataOp) {
      return soFar.then(function(accumulator) {
        return submitOfflineDataOp(accumulator);
      });
    }, $q.when({uploadCount: 0})).then(function(accumulator) {
      return accumulator.uploadCount;
    });
  }

  ret.changeIncidentStatus = function(cluster, photoLoc, status, supervisorId,
    changedTs, onlineOnly, params) {
    return $q(function(resolve, reject) {
      return $http.get(cordovaplConfig.restUrl + '/api/ping', {
        timeout: 10000,
        cache: false
      }).then(function(res) {
        var options = new FileUploadOptions();
        options.fileKey="photo";
        options.fileName=generateUUID() + '.jpg';
        options.chunkedMode= false;
        options.mimeType="image/jpeg";

        var ft = new FileTransfer();
        ft.upload(photoLoc, cordovaplConfig.restUrl + '/api/photos', function(result) {
          var responseJson = JSON.parse(result.response);

          var putUrl = undefined;
          if (status == 1) {
            putUrl = cordovaplConfig.restUrl + '/api/clusters/' + cluster.id + '/status/verified';
          } else if (status == 2) {
            putUrl = cordovaplConfig.restUrl + '/api/clusters/' + cluster.id + '/status/rejected';
          } else if (status == 3) {
            putUrl = cordovaplConfig.restUrl + '/api/clusters/' + cluster.id + '/status/on_repair';
          } else if (status == 4) {
            putUrl = cordovaplConfig.restUrl + '/api/clusters/' + cluster.id + '/status/repaired';
          } else if (status == 5) {
            putUrl = cordovaplConfig.restUrl + '/api/clusters/' + cluster.id + '/status/repair_verified';
          }

          $http.put(putUrl, lodash.merge({photo: responseJson.photo, changed_ts: changedTs}, params), {
            timeout: 10000,
            headers: {
              Authorization: user.getAuthData().auth_token
            }
          }).then(function(res) {
            window.resolveLocalFileSystemURL(photoLoc, function(fileEntry) {
              fileEntry.remove(function() {
                console.log('Image file ' + photoLoc + ' has been deleted');
              },function(error) {
                // Error deleting the file
                console.log('Error deleting image file ' + photoLoc);
                console.log(error);
              },function() {
                // The file doesn't exist
                console.log('File ' + photoLoc + ' does not exist');
              });
            }, function(err) {
              console.log(err);
            });

            cluster.status = status;
            if (status == 1) {
              cluster.photo_verified = options.fileName;
              cluster.verified_ts = changedTs;
            } else if (status == 2) {
              cluster.photo_rejected = options.fileName;
              cluster.rejected_ts = changedTs;
            } else if (status == 3) {
              cluster.photo_on_repair = options.fileName;
              cluster.on_repair_ts = changedTs;
            } else if (status == 4) {
              cluster.photo_repaired = options.fileName;
              cluster.repaired_ts = changedTs;
            } else if (status == 5) {
              cluster.photo_repair_verified = options.fileName;
              cluster.repair_verified_ts = changedTs;
            }

            resolve(true);
          }, function(err) {
            reject(err);
          });
        }, function(err) {
          reject(err);
        }, options);
      }, function(err) {
        if (onlineOnly) {
          reject(err);
        } else {
          var currentTs = new Date().getTime();
          return $cordovaSQLite.execute(getDb(), 'INSERT INTO change_incident_statuses ' +
            '(supervisor_id, cluster_id, status, photo_loc, changed_ts, json_str) VALUES (?, ?, ?, ?, ?, ?)',
            [supervisorId, cluster.id, status, photoLoc, currentTs, JSON.stringify(cluster)])
            .then(function(res) {

            cluster.status = status;
            if (status == 1) {
              cluster.verified_ts = currentTs;
            } else if (status == 2) {
              cluster.rejected_ts = currentTs;
            } else if (status == 3) {
              cluster.on_repair_ts = currentTs;
            } else if (status == 4) {
              cluster.repaired_ts = currentTs;
            } else if (status == 5) {
              cluster.repair_verified_ts = currentTs;
            }

            cluster.pending_submission = true;
            resolve(false);
          }, function (err) {
            reject(err);
          });
        }
      });
    });
  }

  ret.setIncidentRejected = function(cluster, photoLoc, supervisorId, params) {
    return ret.changeIncidentStatus(cluster, photoLoc, 2, supervisorId, new Date().getTime(), false, params);
  }

  ret.setIncidentVerified = function(cluster, photoLoc, supervisorId, params) {
    return ret.changeIncidentStatus(cluster, photoLoc, 1, supervisorId, new Date().getTime(), false, params);
  }

  ret.setIncidentOnRepair= function(cluster, photoLoc, supervisorId, params) {
    return ret.changeIncidentStatus(cluster, photoLoc, 3, supervisorId, new Date().getTime(), false, params);
  }

  ret.setIncidentRepaired= function(cluster, photoLoc, supervisorId, params) {
    return ret.changeIncidentStatus(cluster, photoLoc, 4, supervisorId, new Date().getTime(), false, params);
  }

  ret.setIncidentRepairVerified= function(cluster, photoLoc, supervisorId, params) {
    return ret.changeIncidentStatus(cluster, photoLoc, 5, supervisorId, new Date().getTime(), false, params);
  }

  ret.submitIncident = function(reporteIncidente, onlineOnly) {
    return $q(function(resolve, reject) {
      var rep = {
        userId: user.getAuthData().userDetail.id,
        userRole: reporteIncidente.userRole,
        place: {
          title: reporteIncidente.place.title,
          lat: reporteIncidente.place.lat,
          lng: reporteIncidente.place.lng,
          district: reporteIncidente.place.district,
          borough: reporteIncidente.place.borough,
          city: reporteIncidente.place.city,
          state: reporteIncidente.place.state,
          country: reporteIncidente.place.country
        },
        description: reporteIncidente.description,
        shareSocnets: reporteIncidente.shareSocnets,
        material_type_id: reporteIncidente.materialTypeId,
        cluster_area: reporteIncidente.clusterArea
      };

      return $http.get(cordovaplConfig.restUrl + '/api/ping', {
        timeout: 10000,
        cache: false
      }).then(function(res) {
        if (reporteIncidente.photo == cordovaplConfig.DEFAULT_PHOTO) {
          $http.post(cordovaplConfig.restUrl + '/api/incidents', rep, {
            timeout: 10000,
            headers: {
              Authorization: user.getAuthData().auth_token
            }
          }).then(function(res) {
            rep.online = true;

            if (res.data.fb_failure != undefined) {
              if (res.data.fb_failure.mode == 1) {
                user.setAuthData(res.data.fb_failure.auth_data);
              }

              rep.fb_failure_mode = res.data.fb_failure.mode;
            }

            resolve(rep); //saved online
          }, function(err) {
            reject(err);
          });
        } else {
          var options = new FileUploadOptions();
          options.fileKey = "photo";
          options.chunkedMode = false;

          var fileExtension = reporteIncidente.photo.split('/').slice(-1)[0].split('.').slice(-1)[0].toLowerCase();
          options.fileName = generateUUID() + '.' + fileExtension;
          if (fileExtension == 'jpg' || 'jpeg') {
            options.mimeType = "image/jpeg";
          } else {
            options.mimeType = "image/png";
          }

          var ft = new FileTransfer();
          ft.upload(reporteIncidente.photo, cordovaplConfig.restUrl + '/api/photos', function(result) {
            var responseJson = JSON.parse(result.response);
            var reporteIncidenteOnline = lodash.merge(lodash.clone(rep), {
              photo: responseJson.photo
            });

            $http.post(cordovaplConfig.restUrl + '/api/incidents', reporteIncidenteOnline, {
              timeout: 10000,
              headers: {
                Authorization: user.getAuthData().auth_token
              }
            }).then(function(res) {
              reporteIncidenteOnline.incidentId = res.data.incidentId;
              reporteIncidenteOnline.clusterId = res.data.clusterId;
              reporteIncidenteOnline.online = true;

              window.resolveLocalFileSystemURL(reporteIncidente.photo, function(fileEntry) {
                fileEntry.remove(function() {
                  console.log('Image file ' + reporteIncidente.photo + ' has been deleted');
                },function(error) {
                  // Error deleting the file
                  console.log('Error deleting image file ' + reporteIncidente.photo);
                  console.log(error);
                },function() {
                  // The file doesn't exist
                  console.log('File ' + reporteIncidente.photo + ' does not exist');
                });
              }, function(err) {
                console.log(err);
              });

              if (res.data.fb_failure != undefined) {
                if (res.data.fb_failure.mode == 1) {
                  user.setAuthData(res.data.fb_failure.auth_data);
                }

                reporteIncidenteOnline.fb_failure_mode = res.data.fb_failure.mode;
              }

              resolve(reporteIncidenteOnline); //saved online
            }, function(err) {
              reject(err);
            });
          }, function(err) {
            reject(err);
          }, options);
        }
      }, function(err) {
        /*
        if (reporteIncidente.userRole != 'supervisor') {
          reject(err);
        } else {
          if (onlineOnly) {
            reject(err);
          } else {
            return $cordovaSQLite.execute(getDb(), 'INSERT INTO submit_incidents ' +
              '(supervisor_id, offline_id, json_str) VALUES (?, ?, ?)',
              [user.getAuthData().userDetail.id, generateUUID(), JSON.stringify(reporteIncidente)
            ]).then(function(res) {
              var reporteIncidenteOffline = lodash.merge(lodash.clone(rep), {photo: reporteIncidente.photo, online: false});
              console.log('Saved offline: ' + JSON.stringify(reporteIncidenteOffline));
              resolve(reporteIncidenteOffline);
            }, function (err) {
              reject(err);
            });
          }
        }
        */
        if (onlineOnly) {
          reject(err);
        } else {
          return $cordovaSQLite.execute(getDb(), 'INSERT INTO submit_incidents ' +
            '(supervisor_id, offline_id, json_str) VALUES (?, ?, ?)',
            [user.getAuthData().userDetail.id, generateUUID(), JSON.stringify(reporteIncidente)
          ]).then(function(res) {
            var reporteIncidenteOffline = lodash.merge(lodash.clone(rep), {photo: reporteIncidente.photo, online: false});
            console.log('Saved offline: ' + JSON.stringify(reporteIncidenteOffline));
            resolve(reporteIncidenteOffline);
          }, function (err) {
            reject(err);
          });
        }
      });
    });
  }

  ret.getAnnouncement = function(bb) {
    //for now show all. later use "attended"
    return $http.get(cordovaplConfig.restUrl + '/api/announcements/1', {
      timeout: 10000,
      cache: false,
      headers: {
        Authorization: user.getAuthData().auth_token
      }
    }).then(function(res) {
      return res.data;
    });
  }

  var pictureOptions = {
    destinationType: $cordovaCamera.FILE_URI,
    sourceType: $cordovaCamera.CAMERA,
    allowEdit : false,
    quality : 20,
    encodingType: $cordovaCamera.JPEG,
    saveToPhotoAlbum: false,
    correctOrientation: true,
    targetWidth: 480,
    targetHeight: 480
  };
  ret.takePicture = function() {
    return $cordovaCamera.getPicture(pictureOptions).then(function(imageURI) {
      //$cordovaCamera.cleanup();
      return imageURI;
    }, function(err) {
      console.log(err);
      return cordovaplConfig.DEFAULT_PHOTO;
    });
  }


  return ret;
});
