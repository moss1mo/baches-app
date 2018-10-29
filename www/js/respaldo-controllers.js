angular.module('bachesapp.controllers', ['bachesapp.provinces'])

//http://learn.ionicframework.com/formulas/navigation-and-routing-part-1/
//http://learn.ionicframework.com/formulas/navigation-and-routing-part-2/

.controller('GmapControlCtrl', function($scope) {
  $scope.emitDetectLocation = function() {
    $scope.$emit('detectLocation');
  }
})

.controller('ReportIncidentCtrl', function($scope, $state, $q, user, lodash,
  cordovaplConfig, $cordovaToast, $ionicLoading) {
  $scope.resetStateData = function() {
    $scope.reporteIncidentStateData = {
      savedReporteIncidente: undefined,
    }

    $scope.reporteIncidente = {
      place: $scope.reporteIncidente != undefined ? $scope.reporteIncidente.place : {
        title: cordovaplConfig.CITY_CENTER.title,
        lat: cordovaplConfig.CITY_CENTER.lat,
        lng: cordovaplConfig.CITY_CENTER.lng
      },
      photo: undefined,
      description: undefined,
      fresh: true
    }
  }

  $scope.infoWindow = {
    options: {
      boxClass: 'custom-info-window',
      disableAutoPan: false
    }
  }

  $scope.formatAddressThoroughfare = function(place) {
    return [
      place.thoroughfare || "",
      place.subThoroughfare || "",
    ].join(" ");
  }

  $scope.formatAddressLocality = function(place) {
    return [
      place.subLocality || "",
      place.locality || "",
    ].join(" ");
  }

  $scope.formatAddressProvince = function(place) {
    return [
      place.adminArea || "",
      place.country || "",
    ].join(" ");
  }

  $scope.formatAddress = function(place) {
    return [
      $scope.formatAddressThoroughfare(place),
      $scope.formatAddressLocality(place),
      $scope.formatAddressProvince(place)
    ].join(", ");
  }

  $scope.$on('resetStateData', function(event, args) {
    $scope.resetStateData();
  });
})

.controller('ReportIncidentMapCtrl', function($ionicPlatform, $scope, $state, $q, $ionicActionSheet,
  incidentSvc, $http, $timeout, $ionicModal, $cordovaToast, user, lodash,
  cordovaplConfig, $ionicPopup, $cordovaFile, $ionicHistory,
  $rootScope, $ionicPopover, $ionicLoading, $cordovaGeolocation, mapSvc,
  $ionicScrollDelegate, cordovaplConfig, moment, $location, $anchorScroll, areas) {
  var errToStr = function(err) {
    if (err == undefined) return '';
    if (err.data != undefined) {
      if (err.data.error != undefined) {
        if (err.data.error.detail != undefined) {
          return err.data.error.detail;
        } else {
          return '[-]';
        }
      } else {
        return '[-]';
      }
    }
    if (err.statusText != undefined) return err.statusText;
    if (err.message != undefined) return err.message;
    return '[-]';
  }

  $scope.gmapWindowOptions = {
    disableAutoPan : true
  }
  $scope.userDetail = user.authData.userDetail;

  $scope.supervisorLoginFormData = {}
  var resetSupervisorLoginFormData = function() {
    $scope.supervisorLoginFormData.loginName = undefined;
    $scope.supervisorLoginFormData.password = undefined;
  }

  var updateIncidenteMarkerTitle = function() {
    return $q(function(resolve, reject) {
      $ionicPlatform.ready(function() {
        $scope.doReactToBoundsChanged = false;
        mapSvc.getGeocoder().then(function(geocoder) {
          var location = {
            lat: $scope.incidenteMarker.latitude, lng: $scope.incidenteMarker.longitude
          }
          var locationJsonStr = JSON.stringify(location);
          geocoder.geocode({'location': location}, function(results, status) {
            $timeout(function() {
              if (JSON.stringify({
                lat: $scope.incidenteMarker.latitude, lng: $scope.incidenteMarker.longitude
              }) == locationJsonStr) {
                if (status == 'OK') {
                  var placeStructure = lodash.reduce(results[0].address_components, function(placeStructure, addressComponent) {
                    if (addressComponent.types[0] == 'neighborhood') {
                      placeStructure.district = addressComponent.long_name;
                    } else if (addressComponent.types[0] == 'administrative_area_level_3' ||
                      addressComponent.types[0] == 'sublocality' ||
                      addressComponent.types[0] == 'sublocality_level_1') {
                      placeStructure.borough = addressComponent.long_name;
                    } else if (addressComponent.types[0] == 'locality') {
                      placeStructure.city = addressComponent.long_name;
                    } else if (addressComponent.types[0] == 'administrative_area' ||
                      addressComponent.types[0] == 'administrative_area_level_1') {
                      placeStructure.state = addressComponent.long_name;
                    } else if (addressComponent.types[0] == 'country') {
                      placeStructure.country = addressComponent.long_name;
                    }

                    return placeStructure;
                  }, {});

                  $scope.reporteIncidente.place.district = placeStructure.district;
                  $scope.reporteIncidente.place.borough = placeStructure.borough;
                  $scope.reporteIncidente.place.city = placeStructure.city;
                  $scope.reporteIncidente.place.state = placeStructure.state;
                  $scope.reporteIncidente.place.country = placeStructure.country;

                  $scope.reporteIncidente.place.title = results[0].formatted_address;
                } else {
                  $scope.reporteIncidente.place.title = 'Lat.: ' + $scope.incidenteMarker.latitude + ' / Lng.: ' + $scope.incidenteMarker.longitude;
                }
              }

              resolve(true);
            });
          });
        }, function(err) {
          resolve(false);
        });
      });
    });
  };

  $scope.incidenteMarker = {
    id: 0,
    options: {
      draggable: false
    },
    latitude: cordovaplConfig.CITY_CENTER.lat, longitude: cordovaplConfig.CITY_CENTER.lng,
    events: {
      /*
      dragend: function(maps, eventName, args) {
        $scope.doReactToBoundsChanged = true;
        $timeout(function () {
          var boundsCrossedFlag = true;
          for (var areaIdx = 0; areaIdx < areas.length; areaIdx++) {
            var borders = {
              southwest: {latitude: areas[areaIdx].sw_latitude, longitude: areas[areaIdx].sw_longitude},
              northeast: {latitude: areas[areaIdx].ne_latitude, longitude: areas[areaIdx].ne_longitude},
            }

            if ($scope.incidenteMarker.latitude >= borders.southwest.latitude &&
              $scope.incidenteMarker.longitude >= borders.southwest.longitude &&
              $scope.incidenteMarker.latitude <= borders.northeast.latitude &&
              $scope.incidenteMarker.longitude <= borders.northeast.longitude) {
              boundsCrossedFlag = false;
              break;
            }
          }

          if (boundsCrossedFlag == false) {
            $scope.map.center = {
              latitude: $scope.incidenteMarker.latitude, longitude: $scope.incidenteMarker.longitude
            }

            $scope.reporteIncidente.place.lat = $scope.incidenteMarker.latitude;
            $scope.reporteIncidente.place.lng = $scope.incidenteMarker.longitude;

            updateIncidenteMarkerTitle().then(function(geocoderAvailable) {
              if (geocoderAvailable) {
                $scope.reloadClusters();
              }
            }).then(function() {
              mapSvc.getGmaps().then(function(maps) {
                if ($scope.map.control.getGMap == undefined) return;

                var gMap = $scope.map.control.getGMap();
                try {
                  var gmapBounds = gMap.getBounds();
                  var bounds = {
                    southwest: {
                      latitude: gmapBounds.getSouthWest().lat(), longitude: gmapBounds.getSouthWest().lng()
                    },
                    northeast: {
                      latitude: gmapBounds.getNorthEast().lat(), longitude: gmapBounds.getNorthEast().lng()
                    }
                  }

                  var zoom = gMap.getZoom();
                  previousBounds = bounds;
                  previousCenter = {lat: $scope.map.center.latitude, lng: $scope.map.center.longitude};
                  previousZoom = zoom;
                } catch (exc) {
                  console.log('-');
                  console.log(exc);
                }
              }, function(err) {
                console.log('-ERROR loading google map');
                console.log(err);
              });
            });
          } else {
            $scope.incidenteMarker.latitude = previousCenter.lat;
            $scope.incidenteMarker.longitude = previousCenter.lng;
          }
        });
      }
      */
    }
  }

  var createClusterDetailButtons = function(clusterDetailScope, incidentSvc) {
    if ($scope.userDetail.role != 'supervisor') {
      return [];
    }

    var selectedCluster = clusterDetailScope.selectedMarker.model.incident;
    var ret = [];
    if (selectedCluster.pending_submission) return ret;

    if (selectedCluster.status == 0 || selectedCluster.status == 1) {
      ret.push({
        text: '<i class="icon ion-eye-disabled dark"></i>',
        onTap: function(e) {
          $timeout(function() {
            $ionicPopup.show({
              template: '¿Está seguro de marcar este reporte como No Localizado?',
              title: 'Confirmación',
              buttons: [
                {
                  text: '<i class="icon ion-close dark"></i>',
                  onTap: function(e) {
                    return false;
                  }
                },
                {
                  text: '<i class="icon ion-checkmark dark"></i>',
                  onTap: function(e) {
                    incidentSvc.takePicture().then(function(photoLoc) {
                      if (photoLoc == cordovaplConfig.DEFAULT_PHOTO) {
                        $timeout(function() {
                          $cordovaToast.showLongCenter('Es obligatorio incluir foto en el reporte');
                        });
                      } else {
                        $ionicLoading.show({
                          template: 'Marcando reporte como no localizado...'
                        });
                        incidentSvc.setIncidentRejected(selectedCluster, photoLoc, $scope.userDetail.id).then(function() {
                          clusterDetailScope.selectedMarker.setIcon('img/grey-dot.png');
                          $timeout(function() {
                            $cordovaToast.showLongCenter('Bache ha sido marcado como no localizado');
                          });
                        }, function(err) {
                          if (err.status == 401) {
                            $scope.handleTokenExpired();
                          } else {
                            $timeout(function() {
                              $cordovaToast.showShortCenter('Error marcando bache como no localizado: ' + errToStr(err));
                            });
                          }
                        }).finally(function() {
                          $ionicLoading.hide();
                        });
                      }
                    });
                  }
                }
              ]
            });
          });
        }
      });
      
      ret.push({
        text: '<i class="icon ion-chevron-right dark"></i>',
        onTap: function(e) {
          $timeout(function() {
            $ionicPopup.show({
              template: '¿Está seguro que desea cambiar el estatus de este reporte a Reparado? Esta acción no se podrá deshacer.',
              title: 'Confirmación',
              buttons: [
                {
                  text: '<i class="icon ion-close dark"></i>',
                  onTap: function(e) {
                    return false;
                  }
                },
                {
                  text: '<i class="icon ion-checkmark dark"></i>',
                  onTap: function(e) {
                    incidentSvc.takePicture().then(function(photoLoc) {
                      if (photoLoc == cordovaplConfig.DEFAULT_PHOTO) {
                        $timeout(function() {
                          $cordovaToast.showLongCenter('Es obligatorio incluir foto en el reporte');
                        });
                      } else {
                        return incidentSvc.getMaterialTypes().then(function(materialTypes) {
                          var materialTypeScope = $scope.$new();
                          materialTypeScope.materialTypes = materialTypes;
                          materialTypeScope.params = {
                            selectedMaterialType: undefined,
                            clusterLength: undefined,
                            clusterWidth: undefined
                          };

                          materialTypeScope.selectedMaterialRequiresWidth = function() {
                            if (materialTypeScope.params.selectedMaterialType == undefined) {
                              return false;
                            }

                            return materialTypeScope.params.selectedMaterialType.id == 1 ||
                              materialTypeScope.params.selectedMaterialType.id == 2;
                          }

                          cordova.plugins.Keyboard.disableScroll(false);
                          $ionicPopup.show({
                            templateUrl: 'repaired_detail.html',
                            title: 'Capture medida',
                            scope: materialTypeScope,
                            buttons: [
                              {
                                text: '<i class="icon ion-chevron-left dark"></i>',
                                onTap: function(e) {
                                  cordova.plugins.Keyboard.disableScroll(true);
                                  return false;
                                }
                              },
                              {
                                text: '<i class="icon ion-chevron-right dark"></i>',
                                onTap: function(e) {
                                  cordova.plugins.Keyboard.disableScroll(true);
                                  /*if (materialTypeScope.params.selectedMaterialType == undefined) {
                                    e.preventDefault();
                                    $timeout(function() {
                                      $cordovaToast.showLongCenter('Favor de selecionar un tipo de material');
                                    });
                                  } else */
                                  if (materialTypeScope.params.clusterArea == undefined) {
                                    e.preventDefault();
                                    $timeout(function() {
                                      $cordovaToast.showLongCenter('Favor de especificar el medida del bache');
                                    });
                                  } else {
                                    $ionicLoading.show({
                                      template: 'Marcando bache como reparado...'
                                    });
                                   alert(JSON.stringify(selectedCluster));
                                    incidentSvc.setIncidentRepaired(selectedCluster, photoLoc,
                                      $scope.userDetail.id, {
                                      //material_type_id: materialTypeScope.params.selectedMaterialType.id,
                                      material_type_id: materialTypeScope.materialTypes[0].id,
                                      cluster_area: materialTypeScope.params.clusterArea
                                    }).then(function(online) {
                                      clusterDetailScope.selectedMarker.setIcon('img/green-dot.png');

                                      if (online) {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter('Bache marcado como reparado en servidor');
                                        });
                                      } else {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter('Bache marcado como reparado en dispositivo');
                                        });
                                      }
                                    }, function(err) {
                                      if (err.status == 401) {
                                        $scope.handleTokenExpired();
                                      } else {
                                        $timeout(function() {
                                          $cordovaToast.showShortCenter('Error marcando bache como reparado: ' + errToStr(err));
                                        });
                                      }
                                    }).finally(function() {
                                      $ionicLoading.hide();
                                    });
                                  }
                                }
                              }
                            ]
                          });
                        }, function(err) {
                          if (err.status == 401) {
                            $scope.handleTokenExpired();
                          }
                        });
                      }
                    });
                  }
                }
              ]
            });
          });
        }
      });
    }

    return ret;
  }

  var previousBounds = undefined;
  var previousCenter = undefined;
  var previousZoom = undefined;
  var boundsCrossed = lodash.debounce(function() {
    return mapSvc.getGmaps().then(function(maps) {
      if ($scope.map.control.getGMap == undefined) return true;

      var gMap = $scope.map.control.getGMap();
      try {
        //var weirdBounds = JSON.parse(JSON.stringify(gMap.getBounds()));
        var gmapBounds = gMap.getBounds();
        var bounds = {
          southwest: {
            latitude: gmapBounds.getSouthWest().lat(), longitude: gmapBounds.getSouthWest().lng()
          },
          northeast: {
            latitude: gmapBounds.getNorthEast().lat(), longitude: gmapBounds.getNorthEast().lng()
          }
        }

        var center = {lat: gMap.center.lat(), lng: gMap.center.lng()};
        var zoom = gMap.getZoom();

        if (previousBounds == undefined) {
          previousBounds = bounds;
          previousCenter = center;
          previousZoom = zoom;
          return false;
        } else {
          if (previousBounds.southwest.latitude != bounds.southwest.latitude ||
            previousBounds.southwest.longitude != bounds.southwest.longitude ||
            previousBounds.northeast.latitude != bounds.northeast.latitude ||
            previousBounds.northeast.longitude != bounds.northeast.longitude) {

            var boundsCrossedFlag = true;
            for (var areaIdx = 0; areaIdx < areas.length; areaIdx++) {
              var borders = {
                southwest: {latitude: areas[areaIdx].sw_latitude, longitude: areas[areaIdx].sw_longitude},
                northeast: {latitude: areas[areaIdx].ne_latitude, longitude: areas[areaIdx].ne_longitude},
              }

              if (bounds.southwest.latitude >= borders.southwest.latitude &&
                bounds.southwest.longitude >= borders.southwest.longitude &&
                bounds.northeast.latitude <= borders.northeast.latitude &&
                bounds.northeast.longitude <= borders.northeast.longitude) {
                boundsCrossedFlag = false;
                break;
              }
            }

            if (boundsCrossedFlag == false) {
              previousBounds = bounds;
              previousCenter = center;
              previousZoom = zoom;
              return false;
            } else {
              gMap.setZoom(previousZoom);
              gMap.panTo(previousCenter);
              return true;
            }
          } else {
            return false;
          }
        }
      } catch (exc) {
        console.log(exc);
        return true;
      }
    }, function(err) {
      console.log('ERROR loading google map');
      console.log(err);
      return true;
    });
  }, 100);

  var moveIncidentMarker = lodash.debounce(function() {
    return mapSvc.getGmaps().then(function(maps) {
      if ($scope.map.control.getGMap == undefined) return null;
      var gMap = $scope.map.control.getGMap();
      try {
        if ((gMap.center.lat().toFixed(7) != $scope.incidenteMarker.latitude.toFixed(7)) ||
          (gMap.center.lng().toFixed(7) != $scope.incidenteMarker.longitude.toFixed(7))) {

          $scope.incidenteMarker.latitude = gMap.center.lat();
          $scope.incidenteMarker.longitude = gMap.center.lng();

          $scope.reporteIncidente.place.lat = $scope.incidenteMarker.latitude;
          $scope.reporteIncidente.place.lng = $scope.incidenteMarker.longitude;

          return updateIncidenteMarkerTitle();
        } else {
          return null;
        }
      } catch (exc) {
        console.log(exc);
        return null;
      }
    });
  }, 200);

  $scope.incidentesExistentesMarkers = [];
  $scope.map = {
    options: {
      mapTypeControl: false, streetViewControl: false, maxZoom: 20
    }, control : {}, center: {
      latitude: cordovaplConfig.CITY_CENTER.lat, longitude: cordovaplConfig.CITY_CENTER.lng
    }, zoom: 17, bounds: {}, map_events: {
      dragend: function() {
        $scope.doReactToBoundsChanged = true;
      },
      zoom_changed: function() {
        $scope.doReactToBoundsChanged = true;
      },
      bounds_changed: function() {
        reactToBoundsChange();
      }
    }, marker_events: {
      click: function(marker, eventName, model, arguments) {
        var clusterDetailScope = $scope.$new();
        clusterDetailScope.selectedMarker = marker;

        clusterDetailScope.getSelectedClusterPhotoUrl = function() {
          if (marker.model.incident.photo != undefined) {
            var ret = '';

            if (marker.model.incident.status == 0) {
              ret = cordovaplConfig.staticUrl + '/photos/' + marker.model.incident.photo;
            } else if (marker.model.incident.status == 1) {
              ret = cordovaplConfig.staticUrl + '/photos/' + marker.model.incident.photo_verified;
            } else if (marker.model.incident.status == 2) {
              ret = cordovaplConfig.staticUrl + '/photos/' + marker.model.incident.photo_rejected;
            } else if (marker.model.incident.status == 3) {
              ret = cordovaplConfig.staticUrl + '/photos/' + marker.model.incident.photo_on_repair;
            } else if (marker.model.incident.status == 4) {
              ret = cordovaplConfig.staticUrl + '/photos/' + marker.model.incident.photo_repaired;
            } else if (marker.model.incident.status == 5) {
              ret = cordovaplConfig.staticUrl + '/photos/' + marker.model.incident.photo_repair_verified;
            }

            return ret;
          } else {
            return '../images/no_photo.png';
          }
        }

        clusterDetailScope.formatSelectedClusterStatus = function() {
          if (marker.model.incident.status == 0) {
            if (marker.model.incident.supervisor_id != undefined) {
              return 'Asignado';
            } else {
              return 'No asignado';
            }
          } else if (marker.model.incident.status == 1) {
            return 'Verificado';
          } else if (marker.model.incident.status == 2) {
            return 'Rechazado';
          } else if (marker.model.incident.status == 3) {
            return 'En reparacion';
          } else if (marker.model.incident.status == 4) {
            return 'Reparado';
          } else if (marker.model.incident.status == 5) {
            return 'Reparacion verificado';
          }
        }

        clusterDetailScope.formatTs = function(ts) {
          return moment(parseInt(ts)).format('DD-MMM-YYYY');
        }

        clusterDetailScope.formatSelectedClusterStatusTs = function() {
          if (marker.model.incident.status == 0) {
            if (marker.model.incident.supervisor_id != undefined) {
              return moment(parseInt(marker.model.incident.assigned_ts)).format('DD-MMM-YYYY');
            } else {
              return moment(parseInt(marker.model.incident.focus_incident_created_ts)).format('DD-MMM-YYYY');
            }
          } else if (marker.model.incident.status == 1) {
            return moment(parseInt(marker.model.incident.verified_ts)).format('DD-MMM-YYYY');
          } else if (marker.model.incident.status == 2) {
            return moment(parseInt(marker.model.incident.rejected_ts)).format('DD-MMM-YYYY');
          } else if (marker.model.incident.status == 3) {
            return moment(parseInt(marker.model.incident.on_repair_ts)).format('DD-MMM-YYYY');
          } else if (marker.model.incident.status == 4) {
            return moment(parseInt(marker.model.incident.repaired_ts)).format('DD-MMM-YYYY');
          } else if (marker.model.incident.status == 5) {
            return moment(parseInt(marker.model.incident.repair_verified_ts)).format('DD-MMM-YYYY');
          }
        }

        $ionicPopup.show({
          templateUrl: 'cluster_detail.html',
          title: 'Detalle',
          scope: clusterDetailScope,
          buttons: [
            {
              text: '<i class="icon ion-chevron-left dark"></i>',
              onTap: function(e) {
                return false;
              }
            }
          ].concat(createClusterDetailButtons(clusterDetailScope, incidentSvc))
        });
      }
    }
  };

  // .fromTemplateUrl() method
  $ionicPopover.fromTemplateUrl('actions-popover.html', {
    scope: $scope
  }).then(function(popover) {
    $scope.actionsPopover = popover;
  });

  $scope.$on('detectLocation', function(event) {
    $scope.detectLocation(false);
  });

  $scope.exitWhenDisconnected = true;
  $scope.detectLocation = function(exitWhenDisconnected) {
    if ($scope.exitWhenDisconnected) {
      $ionicLoading.show({
        template: 'Verificando accesso a internet...'
      });
    }

    mapSvc.getGeocoder().then(function(geocoder) {
      $ionicLoading.hide();
      $scope.exitWhenDisconnected = false;
      $ionicLoading.show({
        template: 'Resolviendo ubicacion...'
      });

      $cordovaGeolocation.getCurrentPosition({timeout: 10000, enableHighAccuracy: true})
        .then(function (position) {
        $scope.doReactToBoundsChanged = true;
        $timeout(function() {
          $scope.map.zoom = 17;
          $scope.map.center = {
            latitude: position.coords.latitude, longitude: position.coords.longitude
          }
        });
      }, function(err) {
        $scope.reloadClusters();
        $cordovaToast.showLongCenter('Falla de GPS: ' + err.message);
      }).finally(function() {
        $ionicLoading.hide();
      });
    }, function(err) {
      $ionicLoading.hide();
      if (exitWhenDisconnected) {
        $ionicPopup.show({
          template: 'Favor de asegurar acceso a internet antes de iniciar el app.',
          title: 'Sin internet',
          buttons: [
            {
              text: '<i class="icon ion-close-circled dark"></i>',
              onTap: function(e) {
                document.location.href = 'index.html';
              }
            }
          ]
        });
      }
    });
  }

  $scope.openPopover = function($event) {
    $scope.actionsPopover.show($event);
  };
  $scope.closePopover = function() {
    $scope.actionsPopover.hide();
  };
  //Cleanup the popover when we're done with it!
  $scope.$on('$destroy', function() {
    $scope.actionsPopover.remove();
  });

  $scope.scrollToSection = function(sectionName) {
    $scope.closePopover();

    //this tip is not working: http://www.saintsatplay.com/blog/2015/02/scrolling-to-a-page-anchor-in-ionic-framework#.VxwcE2OxrdR
    window.location.hash = sectionName;
    $timeout(function() {
      $anchorScroll();
    }, 200);
    //http://stackoverflow.com/questions/32989068/ionic-anchorscroll-not-working-on-ios
  }

  $scope.showTerms = function() {
    $scope.closePopover();
    $ionicPopup.alert({
      title: 'Política de Privacidad',
      templateUrl: 'terms.html'
    });
  }

  $scope.showContacts = function() {
    $scope.closePopover();
    $ionicPopup.alert({
      title: 'Contacto',
      templateUrl: 'contacts.html'
    });
  }

  $scope.showSocnetLinks = function() {
    $scope.closePopover();
    $ionicPopup.alert({
      title: 'Redes sociales',
      scope: $scope,
      templateUrl: 'socnet_links.html'
    });
  }

  $scope.showOfflineData = function() {
    $scope.closePopover();

    return $q.all([
      incidentSvc.getOfflineSubmitIncidents($scope.userDetail.id),
      incidentSvc.getOfflineChangeIncidentStatuses($scope.userDetail.id)
    ]).then(function(offlineDatas) {
      var showOfflineDataScope = $scope.$new();

      showOfflineDataScope.offlineSubmitIncidents = offlineDatas[0];
      showOfflineDataScope.offlineChangeIncidentStatuses = offlineDatas[1];

      var buttons = [
        {
          text: '<i class="icon ion-chevron-left dark"></i>',
          onTap: function(e) {
            return false;
          }
        }
      ];

      if ((showOfflineDataScope.offlineSubmitIncidents.length +
        showOfflineDataScope.offlineChangeIncidentStatuses.length) > 0) {
        buttons.push({
          text: '<i class="icon ion-upload dark"></i>',
          onTap: function(e) {
            $ionicLoading.show({
              template: 'Enviando datos offline al servidor...'
            });

            return incidentSvc.submitOfflineData(
              showOfflineDataScope.offlineSubmitIncidents,
              showOfflineDataScope.offlineChangeIncidentStatuses
            ).then(function(uploadCount) {
              if (uploadCount >= (showOfflineDataScope.offlineSubmitIncidents.length + showOfflineDataScope.offlineChangeIncidentStatuses.length)) {
                $scope.reloadClusters();
                $timeout(function() {
                  $cordovaToast.showLongCenter('Todos datos offline han sido guardado');
                });
              } else {
                if (uploadCount <= 0) {
                  $timeout(function() {
                    $cordovaToast.showLongCenter('Ningun datos offline han sido guardado');
                  });
                } else {
                  $scope.reloadClusters();
                  $timeout(function() {
                    $cordovaToast.showLongCenter('Algunos datos offline han sido guardado');
                  });
                }
              }
            }, function(err) {
              $timeout(function() {
                $cordovaToast.showShortCenter('Error guardando datos offline: ' + errToStr(err));
              });
            }).finally(function() {
              $ionicLoading.hide();
            });
          }
        });
      }

      $ionicPopup.show({
        templateUrl: 'offline_data.html',
        title: 'Datos offline',
        scope: showOfflineDataScope,
        buttons: buttons
      });
    });

    $ionicPopup.alert({
      title: 'Terminos de uso',
      templateUrl: 'terms.html'
    });
  }

  $scope.socnetLinkChange = function(socnetLink) {
    if (socnetLink.text == 'Facebook') {
      $ionicLoading.show({
        template: 'Comunicando con Facebook...'
      });

      if (socnetLink.active) {
        user.logoutFacebook(user.authFacebook, user.authFacebook).then(function(result) {
          user.linkFb(result.fbData).then(function() {
            $scope.userDetail = user.authData.userDetail;
          }, function(err) {
            console.log(err);
            if (err.data.error.code == "23505") {
                $cordovaToast.showLongCenter("Usuario Facebook ' " + result.fbName +
                  "' esta asociado con otro usuario BachesApp.");
            } else {
                $cordovaToast.showLongCenter('Error link ' + JSON.stringify(err));
            }
            socnetLink.active = false;
          });
        }, function(err) {
          console.log(err);
          //$cordovaToast.showLongCenter('Error link ' + JSON.stringify(err));
          socnetLink.active = false;
        }).then(function() {
          $ionicLoading.hide();
        });
      } else {
        user.unlinkFb().then(function() {
          $scope.userDetail = user.authData.userDetail;
        }).catch(function(err) {
          $cordovaToast.showLongCenter('Error unlink ' + err);
          socnetLink.active = true;
        }).then(function() {
          $ionicLoading.hide();
        });
      }
    }
  };

  $scope.socnetShareChange = function(socnetShare) {
    if (socnetShare.text == 'Facebook') {
      if (socnetShare.share && user.authData.userDetail.fb_id == undefined) {
        $ionicLoading.show({
          template: 'Comunicando con Facebook...'
        });

        user.logoutFacebook(user.authFacebook, user.authFacebook).then(function(result) {
          user.linkFb(result.fbData).then(function() {
            $scope.userDetail = user.authData.userDetail;
          });
        }, function(err) {
          $cordovaToast.showLongCenter('Error link ' + err);
          socnetShare.share = false;
        }).then(function() {
          $ionicLoading.hide();
        });
      }
    }
  };

  $scope.logout = function() {
    return user.logout().then(function() {
      $scope.closePopover();
      $ionicHistory.clearHistory();

      //http://stackoverflow.com/questions/9293423/can-one-controller-call-another
      //http://ilikekillnerds.com/2014/11/angularjs-call-controller-another-controller/
      $rootScope.$broadcast('resetStateData');

      $state.go('login');
    });
  }

  $scope.handleTokenExpired = function() {
    $ionicPopup.show({
      template: 'El token de authenticacion se expiro. Por favor logear de nuevo.',
      title: 'Auth-token expiro',
      buttons: [
        {
          text: '<i class="icon ion-close-circled dark"></i>',
          onTap: function(e) {
            $scope.logout();
          }
        }
      ]
    });
  }

  $scope.$on('$ionicView.enter', function() {
    $ionicScrollDelegate.scrollTop();
    $scope.userDetail = user.authData.userDetail;
    $scope.socnetLinks = [
      {text: 'Facebook', active: $scope.userDetail.fb_id != undefined}
    ];

    if ($scope.reporteIncidente == undefined || $scope.reporteIncidente.fresh == false) {
      $scope.resetStateData();
    }

    incidentSvc.getAnnouncement().then(function(announcement) {
      $scope.announcement = announcement;
    }, function(err) {
      if (err.status == 401) {
        $scope.handleTokenExpired();
      }
    });
  });

  $scope.reloadAttendedClusters = function(bb) {
    return $q.all([
      incidentSvc.getReportedClusters(bb),
      incidentSvc.getVerifiedClusters(bb),
      //incidentSvc.getOnRepairClusters(bb),
      incidentSvc.getRepairedClusters(bb)
    ]).then(function(clusterLists) {
      return clusterLists[0].concat(clusterLists[1], clusterLists[2]);
    });
  }

  $scope.reloadAssignedClusters = function(bb) {
    return $q.all([
      incidentSvc.getAssignedClusters(bb, $scope.userDetail.id)
    ]).then(function(clusterLists) {
      var assignedClusters = clusterLists[0];
      return incidentSvc.getOfflineChangeIncidentStatuses($scope.userDetail.id)
        .then(function(offlineChangeIncidentStatuses) {
          var keyedOfflineChangeIncidentStatuses = lodash.keyBy(offlineChangeIncidentStatuses, 'cluster_id');

          lodash.forEach(assignedClusters, function(assignedCluster) {
            var matchingOfflineChangeIncidentStatus = keyedOfflineChangeIncidentStatuses[assignedCluster.cluster_id];
            if (matchingOfflineChangeIncidentStatus != undefined) {
              assignedCluster.status = matchingOfflineChangeIncidentStatus.status;
              if (assignedCluster.status == 1) {
                assignedCluster.verified_ts = matchingOfflineChangeIncidentStatus.changed_ts;
              } else if (assignedCluster.status == 2) {
                assignedCluster.rejected_ts = matchingOfflineChangeIncidentStatus.changed_ts;
              } else if (assignedCluster.status == 3) {
                assignedCluster.on_repair_ts = matchingOfflineChangeIncidentStatus.changed_ts;
              } else if (assignedCluster.status == 4) {
                assignedCluster.repaired_ts = matchingOfflineChangeIncidentStatus.changed_ts;
              } else if (assignedCluster.status == 5) {
                assignedCluster.repair_verified_ts = matchingOfflineChangeIncidentStatus.changed_ts;
              }

              assignedCluster.pending_submission = true;
            }
          });

          return lodash.filter(assignedClusters, function(cluster) {
            return (cluster.status == 0 || cluster.status == 1);
          });
      });
    });
  }

  $scope.openAnnouncement = function() {
    window.open($scope.announcement.site_url, '_system', 'location=yes');
    return false;
  }

  $scope.submitIncidentCanceller = undefined;
  $scope.submitIncident = function(shareSocnets) {
    $scope.reporteIncidentStateData.savedReporteIncidente = undefined;
    $scope.submitIncidentCanceller = $q.defer();
    $scope.reporteIncidente.userRole = $scope.userDetail.role;
    $scope.reporteIncidente.shareSocnets = shareSocnets;

    $ionicLoading.show({
      template: 'Enviando reporte al servidor...'
    });
    incidentSvc.submitIncident($scope.reporteIncidente).then(function(reporteIncidente) {
      $scope.reporteIncidente.fresh = false;
      $scope.reporteIncidentStateData.savedReporteIncidente = reporteIncidente;
      //but when to delete the photo? We shouldn't delete the photo, btw....
      //$scope.reporteIncidentStateData.savedReporteIncidente.photo = $scope.reporteIncidente.photo; //better show offline photo
      $scope.submitIncidentCanceller.resolve(true);
      $scope.submitIncidentCanceller = undefined;

      if (reporteIncidente.online) {
        if (reporteIncidente.fb_failure_mode == 1) {
          $scope.userDetail = user.authData.userDetail;

          $timeout(function() {
            $cordovaToast.showLongCenter('Reporte ha sido guardado en servidor. Link con facebook desactivado.');
          });
        } else {
          $timeout(function() {
            $cordovaToast.showLongCenter('Reporte enviado exitosamente.');
          });
        }
      } else {
        $timeout(function() {
          $cordovaToast.showLongCenter('Reporte ha sido guardado en dispositivo');
        });
      }

      $timeout(function() {
        $state.go('tab.report-incident.success');
      });
    }, function(err) {
      $scope.submitIncidentCanceller.reject(err);
      $scope.submitIncidentCanceller = undefined;

      if (err.status == 401) {
        $scope.handleTokenExpired();
      } else {
        $timeout(function() {
          $cordovaToast.showLongCenter('Error en guardar el reporte: ' + errToStr(err));
        });
      }
    }).finally(function() {
      $ionicLoading.hide();
    });
  }

  var askEnviarReporteOptions = function() {
    var enviarReporteOptions = $scope.$new();
    enviarReporteOptions.takePhoto = {active: true};
    enviarReporteOptions.shareSocnets = [
      {id: "facebook", text: "Facebook", share: false, disabled: (enviarReporteOptions.userDetail.fb_id == undefined)}
    ]

    $ionicPopup.show({
      templateUrl: 'link.post_report_option.html',
      title: 'Enviar reporte',
      scope: enviarReporteOptions,
      buttons: [
        {
          text: '<b>Enviar</b>',
          type: 'button-positive',
          onTap: function(e) {
            if (enviarReporteOptions.takePhoto.active) {
              incidentSvc.takePicture().then(function(photoLoc) {
                $scope.reporteIncidente.photo = photoLoc;
                $scope.reporteIncidente.description = ' ';
                $scope.submitIncident(lodash.chain(enviarReporteOptions.shareSocnets)
                  .filter(function(shareSocnet) {
                  return shareSocnet.share == true;
                }).map(function(shareSocnet) {
                  return shareSocnet.id;
                }).value());
              });
            } else {
              $scope.reporteIncidente.photo = cordovaplConfig.DEFAULT_PHOTO;
              $scope.reporteIncidente.description = 'ciudadano';
              $scope.submitIncident(lodash.chain(enviarReporteOptions.shareSocnets)
                .filter(function(shareSocnet) {
                return shareSocnet.share == true;
              }).map(function(shareSocnet) {
                return shareSocnet.id;
              }).value());
            }
          }
        }
      ]
    });
  }

  $scope.mapImgSrc = "";
  $scope.askTakePhoto = function() {
    if ($scope.userDetail.role == 'supervisor') {
      if ($scope.userDetail.fb_id == undefined) {
        incidentSvc.takePicture().then(function(photoLoc) {
          if (photoLoc == cordovaplConfig.DEFAULT_PHOTO) {
            $timeout(function() {
              $cordovaToast.showLongCenter('Es obligatorio incluir foto en el reporte');
            });
          } else {
            $scope.reporteIncidente.photo = photoLoc;
            $scope.reporteIncidente.description = 'supervisor';
            $scope.submitIncident([]);
          }
        });
      } else {
        askEnviarReporteOptions();
      }
    } else {
      askEnviarReporteOptions();
    }
  }


  $scope.markAsReparedDirect = function()
  {
  

          incidentSvc.takePicture().then(function(photoLoc) {
                      if (photoLoc == cordovaplConfig.DEFAULT_PHOTO) {
                        $timeout(function() {
                          $cordovaToast.showLongCenter("Es obligatorio incluir foto en el reporte");
                        });
                      } else {
                        return incidentSvc.getMaterialTypes().then(function(materialTypes) {
                          var materialTypeScope = $scope.$new();
                          materialTypeScope.materialTypes = materialTypes;
                          materialTypeScope.params = {
                            selectedMaterialType: undefined,
                            clusterLength: undefined,
                            clusterWidth: undefined
                          };
                        
                      
                    


                          materialTypeScope.selectedMaterialRequiresWidth = function() {
                            if (materialTypeScope.params.selectedMaterialType == undefined) {
                              return false;
                            }

                            return materialTypeScope.params.selectedMaterialType.id == 1 ||
                              materialTypeScope.params.selectedMaterialType.id == 2;
                          }


                          cordova.plugins.Keyboard.disableScroll(false);
                          //Codigo donde llama el popup de medidas
                          $ionicPopup.show({
                            templateUrl: "repaired_detail.html",
                            title: 'Capture medida',
                            scope: materialTypeScope,
                            buttons: [
                              {
                                text: '<i class="icon ion-chevron-left dark"></i>',
                                onTap: function(e) {
                                  cordova.plugins.Keyboard.disableScroll(true);
                                  return false;
                                }
                              },
                              {
                                text: '<i class="icon ion-chevron-right dark"></i>',
                                onTap: function(e) {
                                  cordova.plugins.Keyboard.disableScroll(true);
                                  if (materialTypeScope.params.clusterArea == undefined) {
                                    e.preventDefault();
                                    $timeout(function() {
                                      $cordovaToast.showLongCenter("Favor de especificar el medida del bache");
                                    });
                                  } else {
                                    $ionicLoading.show({
                                      template: "Marcando bache como reparado..."
                                    });


                                     $scope.reporteIncidente.photo = photoLoc;
                                     $scope.reporteIncidente.description = 'supervisor';
                                    //$scope.submitIncident([]);

                                    $scope.reporteIncidentStateData.savedReporteIncidente = undefined;
                                    $scope.submitIncidentCanceller = $q.defer();
                                    $scope.reporteIncidente.userRole = $scope.userDetail.role;
                                    $scope.reporteIncidente.shareSocnets = [];

                                    $ionicLoading.show({
                                      template: 'Enviando reporte al servidor...'
                                    });
                                    incidentSvc.submitIncident($scope.reporteIncidente).then(function(reporteIncidente) {
                                      $scope.reporteIncidente.fresh = false;
                                      $scope.reporteIncidentStateData.savedReporteIncidente = reporteIncidente;
                                      //but when to delete the photo? We shouldn't delete the photo, btw....
                                      //$scope.reporteIncidentStateData.savedReporteIncidente.photo = $scope.reporteIncidente.photo; //better show offline photo
                                      $scope.submitIncidentCanceller.resolve(true);
                                      $scope.submitIncidentCanceller = undefined;

                                      if (reporteIncidente.online) {
                                        if (reporteIncidente.fb_failure_mode == 1) {
                                          $scope.userDetail = user.authData.userDetail;

                                          $timeout(function() {
                                            $cordovaToast.showLongCenter('Reporte ha sido guardado en servidor. Link con facebook desactivado.');
                                          });
                                        } else {
                                          $timeout(function() {
                                            $cordovaToast.showLongCenter('Reporte enviado exitosamente.');
                                          });
                                        }
                                      } else {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter('Reporte ha sido guardado en dispositivo');
                                        });
                                      }

                                      $timeout(function() {
                                        $state.go('tab.report-incident.success');
                                      });

                                        //codigo despues del guardado inicial

                                        alert("iduser:"+$scope.userDetail.id);
                                   
                                    incidentSvc.getLastAssignedCluster($scope.userDetail.id).then(function(incident) {

                                    

                                       alert(JSON.stringify(incident));

                                      //consultar el ultimo reporte para cambiar el status



                                    incidentSvc.setIncidentRepaired(incident, photoLoc,
                                      $scope.userDetail.id, {
                                      material_type_id: materialTypeScope.materialTypes[0].id,
                                      cluster_area: materialTypeScope.params.clusterArea
                                    }).then(function(online) {
                                      clusterDetailScope.selectedMarker.setIcon("img/green-dot.png");

                                      if (online) {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter("Bache marcado como reparado en servidor");
                                        });
                                      } else {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter("Bache marcado como reparado en dispositivo");
                                        });
                                      }
                                    }, function(err) {
                                      if (err.status == 401) {
                                        $scope.handleTokenExpired();
                                      } else {
                                        $timeout(function() {
                                          alert(JSON.stringify(err));
                                          $cordovaToast.showShortCenter("Error marcando bache como reparado: " + errToStr(err));
                                        });
                                      }
                                    }).finally(function() {
                                      $ionicLoading.hide();
                                    });









                                    });


                                        //codigo despues del guardado inicial






                                    }, function(err) {
                                      $scope.submitIncidentCanceller.reject(err);
                                      $scope.submitIncidentCanceller = undefined;

                                      if (err.status == 401) {
                                        $scope.handleTokenExpired();
                                      } else {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter('Error en guardar el reporte: ' + errToStr(err));
                                        });
                                      }
                                    }).finally(function() {
                                      $ionicLoading.hide();
                                    });

                                     
                                  }
                                }
                              }]

                            });//Termina Codigo donde llama el popup de medidas
                        }) // return incidentSvc.getMaterialTypes().then(function(materialTypes)
                      }//else

                          
                      

          })// cierre de incidentSvc.takePicture().then(function(photoLoc) {




    }



  $scope.reloadClusters = function() {
    mapSvc.getGmaps().then(function(maps) {
      if ($scope.map.control.getGMap == undefined) return null;

      var gMap = $scope.map.control.getGMap();
      try {
        var loadClusters = undefined;

        var gmapBounds = gMap.getBounds();
        var bounds = {
          southwest: {
            latitude: gmapBounds.getSouthWest().lat(), longitude: gmapBounds.getSouthWest().lng()
          },
          northeast: {
            latitude: gmapBounds.getNorthEast().lat(), longitude: gmapBounds.getNorthEast().lng()
          }
        }

        if ($scope.userDetail.role == 'supervisor') {
          loadClusters = $scope.reloadAssignedClusters([
            bounds.southwest.latitude, bounds.southwest.longitude,
            bounds.northeast.latitude, bounds.northeast.longitude
          ]);
        } else {
          loadClusters = $scope.reloadAttendedClusters([
            bounds.southwest.latitude, bounds.southwest.longitude,
            bounds.northeast.latitude, bounds.northeast.longitude
          ]);
        }

        loadClusters.then(function(incidents) {
          rebuildIncidentesExistentesMarkers(incidents);
        }, function(err) {
          if (err.status == 401) {
            $scope.handleTokenExpired();
          }
        });
      } catch (exc) {
        console.log(exc);
      }
    }, function(err) {
      console.log('ERROR loading google map');
      console.log(err);
    });
  };

  $scope.doReactToBoundsChanged = true;
  var reactToBoundsChange = lodash.debounce(function() {
    if ($scope.doReactToBoundsChanged == false) {
      return;
    }

    var boundsCrossedPromise = boundsCrossed();
    if (boundsCrossedPromise != undefined) {
      boundsCrossedPromise.then(function(crossed) {
        if (crossed == false) {
          moveIncidentMarker();
          $scope.reloadClusters();
        }
      });
    } else {
      moveIncidentMarker();
      $scope.reloadClusters();
    }
  }, 250);

  var rebuildIncidentesExistentesMarkers = function(incidents) {
    $timeout(function() {
      $scope.incidentesExistentesMarkers = lodash.map(incidents, function(incident) {
        var iconFile = 'img/red-dot.png';
        if (incident.supervisor_id != undefined) {
          if (incident.status == 0) {
            if ($scope.userDetail.role == 'supervisor') {
                iconFile = 'img/yellow-dot.png';
            }
          } else if (incident.status == 1) {
            if ($scope.userDetail.role == 'supervisor') {
              iconFile = 'img/yellow-dot.png';
            }
          } else if (incident.status == 2) {
            iconFile = 'img/grey-dot.png';
          } else if (incident.status == 3) {
            iconFile = 'img/green-hollow-dot.png';
          } else if (incident.status == 4) {
            iconFile = 'img/green-dot.png';
          } else if (incident.status == 5) {
            iconFile = 'img/green-dot.png';
          }
        }

        return {
          id: incident.id,
          latitude: incident.place.lat,
          longitude: incident.place.lng,
          title: incident.description,
          snippet: incident.place.title,
          icon: iconFile,
          incident: incident //TODO: first green to red
        };
      });
    });
  }

  $scope.$on('$destroy', function() {
    $scope.placeSearchInputModal.remove();
  });

  var loginSupervisorExecuting = false;
  $scope.showLoginSupervisor = function() {
    cordova.plugins.Keyboard.disableScroll(false);
    $ionicPopup.show({
      templateUrl: 'login_supervisor.html',
      title: 'Login Supervisor',
      scope: $scope,
      buttons: [
        {
          text: 'Cancelar',
          onTap: function(e) {
            cordova.plugins.Keyboard.disableScroll(true);
            return false;
          }
        },
        {
          text: '<b>Login</b>',
          type: 'button-positive',
          onTap: function(e) {
            cordova.plugins.Keyboard.disableScroll(true);
            loginSupervisorExecuting = true;

            $ionicLoading.show({
              template: 'Autenticando como supervisor...'
            });
            return user.loginSupervisor($scope.supervisorLoginFormData.loginName,
              $scope.supervisorLoginFormData.password).then(function(authData) {

              //return incidentSvc.getClusterTypes().then(function(clusterTypes) {
                return incidentSvc.getMaterialTypes().then(function(materialTypes) {
                  return {
                    authData: authData,
                    //clusterTypes: clusterTypes,
                    materialTypes: materialTypes
                  }
                });
              //});
            }).then(function(data) {
              loginSupervisorExecuting = false;
              $scope.userDetail = user.authData.userDetail;
              $scope.reloadClusters();
              $ionicScrollDelegate.scrollTop();
            }, function(err) {
              loginSupervisorExecuting = false;

              if (err.status == 0) {
                $timeout(function() {
                  $cordovaToast.showShortCenter('No hay conexion al servidor');
                });
              } else if (err.status != 404) {
                $timeout(function() {
                  $cordovaToast.showShortCenter(lodash.get(err, 'data.error', 'Error: ' + err));
                });
              } else {
                $timeout(function() {
                  $cordovaToast.showShortCenter('Login supervisor fallido');
                });
              }
            }).finally(function() {
              $ionicLoading.hide();
            });
          }
        }
      ]
    });
  }

  $scope.$on('$ionicView.enter', function() {
    $scope.detectLocation($scope.exitWhenDisconnected);
  });
})

.controller('ReportIncidentSuccessCtrl', function($scope, $state, $q, $ionicHistory,
  user, cordovaplConfig, $http, $ionicLoading) {
  $scope.$on('$ionicView.leave', function() {
    $ionicHistory.clearHistory();
  });

  var setImgSrcs = function() {
    if ($scope.imgSrcCode == 1) {
      $scope.mainImgSrc = $scope.photoImgSrc;
      $scope.thumbnailImgSrc = $scope.mapImgSrc;
    } else if ($scope.imgSrcCode == 2) {
      $scope.mainImgSrc = $scope.mapImgSrc;
      $scope.thumbnailImgSrc = $scope.photoImgSrc;
    }
  }

  var setMapImgSrcToGoogle = function() {
    $scope.mapImgSrc = 'https://maps.googleapis.com/maps/api/staticmap?center=' +
      $scope.reporteIncidentStateData.savedReporteIncidente.place.lat + ',' +
      $scope.reporteIncidentStateData.savedReporteIncidente.place.lng +
      '&zoom=16&size=320x240&maptype=roadmap&markers=color:red%7C' +
      $scope.reporteIncidentStateData.savedReporteIncidente.place.lat + ',' +
      $scope.reporteIncidentStateData.savedReporteIncidente.place.lng +
      '&key=' + 'AIzaSyC9_qEoKX2LD5AmHi2wNs3RTu3PqQTgLDQ';

    setImgSrcs();
  }

  $scope.$on('$ionicView.enter', function() {
    $scope.imgSrcCode = 1; //1: photo, 2: map

    if ($scope.reporteIncidentStateData.savedReporteIncidente.online) {
      if ($scope.reporteIncidentStateData.savedReporteIncidente.photo != undefined) {
        $scope.photoImgSrc = cordovaplConfig.staticUrl + '/photos/' +
          $scope.reporteIncidentStateData.savedReporteIncidente.photo;
      } else {
        $scope.photoImgSrc = 'file:///android_asset/www/img/white.png';
      }
    } else {
      $scope.photoImgSrc = $scope.reporteIncidentStateData.savedReporteIncidente.photo;
      if ($scope.photoImgSrc == undefined) {
        $scope.photoImgSrc = 'img/white.png';
      }
    }

    $scope.mapImgSrc = 'img/white.png';
    setImgSrcs();
    $scope.$apply();

    $http.get('https://maps.googleapis.com/maps/api/staticmap', {
      timeout: 2000
    }).then(function(res) {
      //$scope.mainImgSrc = cordovaplConfig.staticUrl + '/photos/' + $scope.reporteIncidentStateData.savedReporteIncidente.photo;
      setMapImgSrcToGoogle();
    }, function(err) {
      if (err.status == 400) {
        setMapImgSrcToGoogle();
      } else {
        $scope.mapImgSrc = 'img/map.png';
        setImgSrcs();
      }
    });
  });

  $scope.toggleImgSrc = function() {
    if ($scope.imgSrcCode == 1) {
      $scope.mainImgSrc = $scope.mapImgSrc;
      $scope.thumbnailImgSrc = $scope.photoImgSrc;

      $scope.imgSrcCode = 2;
    } else if ($scope.imgSrcCode == 2){
      $scope.mainImgSrc = $scope.photoImgSrc;
      $scope.thumbnailImgSrc = $scope.mapImgSrc;

      $scope.imgSrcCode = 1;
    }
  }

  $scope.newIncident = function() {
    $state.go('tab.report-incident.map');
  }
})

.controller('LoginCtrl', function($ionicPopup, $scope, $state, $q, user, $timeout,
  $cordovaToast, lodash, incidentSvc, $ionicLoading, provinces, $http) {
  $scope.duh = function() {
    //console.log('sss');
  };

  $scope.stuffs =  [
    {label: "Value1", id:"1"},
    {label: "Value2", id:"2"},
    {label: "Value3", id:"3"},
    {label: "Value4", id:"4"},
  ];

  var errToStr = function(err) {
    if (err == undefined) return '';
    if (err.data != undefined) {
      if (err.data.error != undefined) {
        if (err.data.error.detail != undefined) {
          return err.data.error.detail;
        } else {
          return '[-]';
        }
      } else {
        return '[-]';
      }
    }
    if (err.statusText != undefined) return err.statusText;
    if (err.message != undefined) return err.message;
    return '[-]';
  }

  $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
  $scope.showTerms = true;

  $scope.loginFormData = {}
  var resetLoginFormData = function() {
    $scope.loginFormData.loginName = undefined;
    $scope.loginFormData.password = undefined;
  }

  $scope.registrationFormData = {}
  var resetRegistrationFormData = function() {
    $scope.registrationFormData.email = undefined;
    $scope.registrationFormData.name = undefined;
    $scope.registrationFormData.password = undefined;
    $scope.registrationFormData.passwordConfirmation = undefined;
    $scope.registrationFormData.geo_state = undefined;
    $scope.registrationFormData.geo_municipality = undefined;
    $scope.registrationFormData.fbData = undefined;
    $scope.registrationFormData.fbName = undefined;
  }

  $scope.$on('$ionicView.enter', function() {
    $scope.showTerms = true;
    resetLoginFormData();
    resetRegistrationFormData();
  });

  //-----
  var doRegisterCiudadano = function(registerCiudadanoPopup) {
    if (window.cordova != undefined) {
      cordova.plugins.Keyboard.disableScroll(true);
    }

    if ($scope.registrationFormData.email == undefined) {
      $timeout(function() {
        $cordovaToast.showShortCenter('Favor de especificar correo electrónico');
      });
    } else if ($scope.registrationFormData.password == undefined) {
      $timeout(function() {
        $cordovaToast.showShortCenter('Favor de especificar contraseña');
      });
    } else if ($scope.registrationFormData.passwordConfirmation == undefined) {
      $timeout(function() {
        $cordovaToast.showShortCenter('Favor de confirmar contraseña');
      });
    } else if ($scope.registrationFormData.name == undefined) {
      $timeout(function() {
        $cordovaToast.showShortCenter('Favor de especificar nombre completo');
      });
    } else if ($scope.registrationFormData.password != $scope.registrationFormData.passwordConfirmation) {
      $scope.registrationFormData.password = undefined;
      $scope.registrationFormData.passwordConfirmation = undefined;
      $timeout(function() {
        $cordovaToast.showShortCenter('Passwords no matchea');
      });
    } else {
      registerCiudadanoPopup.close();
      $ionicPopup.show({
        templateUrl: 'login.aviso_privacidad.html',
        title: 'Política de Privacidad',
        scope: $scope,
        buttons: [
          {
            text: 'No',
            onTap: function(e) {
              //NOOP
            }
          },
          {
            text: '<b>Sí</b>',
            type: 'button-positive',
            onTap: function(e) {
              $ionicLoading.show({
                template: 'Registrando...'
              });

              user.submitRegisterCiudadano({
                login_name: $scope.registrationFormData.email,
                password: $scope.registrationFormData.password,
                name: $scope.registrationFormData.name,
                email: $scope.registrationFormData.email,
                geo_state: $scope.registrationFormData.geo_state,
                geo_municipality: $scope.registrationFormData.geo_municipality
              }, $scope.registrationFormData.fbData).then(function() {
                $ionicLoading.hide();

                $scope.loginFormData.loginName = $scope.registrationFormData.email;
                $scope.loginFormData.password = $scope.registrationFormData.password;

                $ionicPopup.show({
                  templateUrl: 'login.usuario_registrado.html',
                  title: 'Usuario registrado',
                  scope: $scope,
                  buttons: [
                    {
                      text: '<b>Ok</b>',
                      type: 'button-positive',
                      onTap: function(e) {
                      }
                    }
                  ]
                });
              }, function(err) {
                $ionicLoading.hide();

                $timeout(function() {
                  console.log(err);
                  if (lodash.get(err, 'data.error.code') == "23505") {
                    $cordovaToast.showLongCenter("Usuario Facebook '" + $scope.registrationFormData.fbName +
                      "' esta asociado con usuario BachesApp existente");
                  } else {
                    $cordovaToast.showShortCenter('Error durante registracion.' + errToStr(err));
                  }
                });

                $scope.loginFormData.loginName = '';
                $scope.loginFormData.password = '';
              });
            }
          }
        ]
      });
    }
  }

  $scope.showRegisterCiudadano = function(reset) {
    resetRegistrationFormData();
    $scope.registrationFormData.email = $scope.loginFormData.loginName;
    $scope.provinces = provinces;

    $scope.selectedProvinceChanged = function(selectedProvince) {
      $scope.selectedMunicipality = null;

      if (selectedProvince != null) {
          $scope.registrationFormData.geo_state = selectedProvince.id;

          var baseUrl = "";
          if(ionic.Platform.isAndroid()){
            baseUrl = "/android_asset/www/";
          }
          $http.get(baseUrl + 'js/municipalities/' + $scope.registrationFormData.geo_state + '.json')
      			.success(function(response) {
              $scope.municipalities = response;
            }, function(err) {
              console.log(err);
              $scope.municipalities = null;
              $scope.registrationFormData.geo_state = undefined;
            });
      } else {
        $scope.municipalities = null;
        $scope.registrationFormData.geo_state = undefined;
      }
    };

    $scope.selectedMunicipalityChanged = function(selectedMunicipality) {
      if (selectedMunicipality != null) {
          $scope.registrationFormData.geo_municipality = selectedMunicipality.id;
      } else {
        $scope.registrationFormData.geo_municipality = undefined;
      }
    };

    if (window.cordova != undefined) {
      cordova.plugins.Keyboard.disableScroll(false);
    }
    var registerCiudadanoPopup = $ionicPopup.show({
      templateUrl: 'register_ciudadano.html',
      title: 'Registrar perfil ciudadano',
      scope: $scope,
      buttons: [
        {
          type: 'ion-close-circled',
          onTap: function(e) {
            //NOOP
            if (window.cordova != undefined) {
              cordova.plugins.Keyboard.disableScroll(true);
            }
          }
        },
        {
          text: '<img src="img/square-facebook-16.png" style="vertical-align: middle;"/>',
          onTap: function(e) {
            e.preventDefault();
            $ionicLoading.show({
              template: 'Comunicando con Facebook...'
            });

            user.logoutFacebook(user.authFacebook, user.authFacebook).then(function(result) {
              $timeout(function() {
                lodash.assign($scope.registrationFormData, result.userData);
                $scope.registrationFormData.fbData = result.fbData;
                $scope.registrationFormData.fbName = result.fbName;
              });
            }, function(error) {
              console.log(error);
              if (error.code == 5) {
                //User cancelled dialog (of the first login)
              }
            }).then(function() {
              $ionicLoading.hide();
            });
          }
        },
        {
          type: 'button-positive ion-checkmark-circled',
          onTap: function(e) {
            e.preventDefault();
            $scope.loginFormData.loginName = '';
            $scope.loginFormData.password = '';
            doRegisterCiudadano(registerCiudadanoPopup);
          }
        }
      ]
    });
  };

  var loginExecuting = false;
  $scope.loginCiudadano = function() {
    if ($scope.loginFormData.loginName == undefined) {
      $timeout(function() {
        $cordovaToast.showShortCenter('Favor de especificar nombre de login');
      });
    } else if ($scope.loginFormData.password == undefined) {
      $timeout(function() {
        $cordovaToast.showShortCenter('Favor de especificar password');
      });
    } else {
      loginExecuting = true;

      $ionicLoading.show({
        template: 'Autenticando...'
      });
      return user.loginCiudadano($scope.loginFormData.loginName, $scope.loginFormData.password).then(function(authData) {
        loginExecuting = false;
        $state.go('tab.report-incident.map');
      }, function(err) {
        loginExecuting = false;
        if (err.status == 0) {
          $timeout(function() {
            $cordovaToast.showShortCenter('No hay conexion al servidor');
          });
        } else if (err.status != 404) {
          $timeout(function() {
            $cordovaToast.showShortCenter(lodash.get(err, 'data.error', 'Error: ' + err));
          });
        } else {
          if (lodash.get(err, 'data.error') == 'Perfil no registrado') {
            $ionicPopup.show({
              template: 'Usuario no registrado. ¿Quiere registrar?',
              title: 'Aviso',
              scope: $scope,
              buttons: [
                {
                  text: 'No',
                  onTap: function(e) {
                    return false;
                  }
                },
                {
                  text: '<b>Sí</b>',
                  type: 'button-positive',
                  onTap: function(e) {
                    return true;
                  }
                }
              ]
            }).then(function(showRegisterCiudadano) {
              if (showRegisterCiudadano) {
                $scope.showRegisterCiudadano();
              };
            });
          } else {
            if (lodash.get(err, 'data.error') == 'Password incorrecto') {
              $ionicPopup.show({
                template: 'Password incorrecto',
                title: 'Aviso',
                scope: $scope,
                buttons: [
                  {
                    text: 'Ok',
                    onTap: function(e) {
                      $scope.loginFormData.password = '';
                      return false;
                    }
                  }
                ]
              });
            } else {
              $ionicPopup.show({
                template: 'Problema durante authenticacion: ' + lodash.get(err, 'data.error', 'Error: ' + err),
                title: 'Aviso',
                scope: $scope,
                buttons: [
                  {
                    text: 'Ok',
                    onTap: function(e) {
                      return false;
                    }
                  }
                ]
              });
            }
          }
        }
      }).finally(function() {
        $ionicLoading.hide();
      });
    }
  }

  $scope.loginCiudadanoFb = function() {
    loginExecuting = true;

    $ionicLoading.show({
      template: 'Autenticando como ciudadano...'
    });
    return user.loginCiudadano($scope.loginFormData.loginName, $scope.loginFormData.password).then(function(authData) {
      loginExecuting = false;
      $state.go('tab.report-incident.map');
    }, function(err) {
      loginExecuting = false;
      if (err.status == 0) {
        $timeout(function() {
          $cordovaToast.showShortCenter('No hay conexion al servidor');
        });
      } else if (err.status != 404) {
        $timeout(function() {
          $cordovaToast.showShortCenter(lodash.get(err, 'data.error', 'Error: ' + err));
        });
      } else {
        $ionicPopup.show({
          template: lodash.get(err, 'data.error', 'Error: ' + err) + '. Quiere registrar?',
          title: 'Aviso',
          scope: $scope,
          buttons: [
            {
              text: 'No',
              onTap: function(e) {
                return false;
              }
            },
            {
              text: '<b>Sí</b>',
              type: 'button-positive',
              onTap: function(e) {
                return true;
              }
            }
          ]
        }).then(function(showRegisterCiudadano) {
          if (showRegisterCiudadano) {
            $scope.showRegisterCiudadano();
          };
        });
      }
    }).finally(function() {
      $ionicLoading.hide();
    });
  }

  $scope.showTermsChanged = function() {
    $scope.showTerms = !$scope.showTerms;
  }

  $scope.loginEnabled = function() {
    return $scope.showTerms == true && loginExecuting == false && !user.isAuthenticated();
  }
});
