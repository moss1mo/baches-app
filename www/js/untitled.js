


                          var motivoScope = $scope.$new();
                          motivoScope.params = {
                            motivo: undefined,
                          };

                         

                          cordova.plugins.Keyboard.disableScroll(false);
                          $ionicPopup.show({
                            templateUrl: 'motivo.html',
                            title: 'Capture el motivo',
                            scope: motivoScope,
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
                                  if (motivoScope.params.motivo == undefined) {
                                    e.preventDefault();
                                    $timeout(function() {
                                      $cordovaToast.showLongCenter('Favor de especificar el motivo de porque no corresponde el reporte');
                                    });
                                  } else {

                                  	$ionicLoading.show({
                          template: 'Marcando reporte como no correspondiente...'
                        });
                        incidentSvc.setIncidentRejected(selectedCluster, photoLoc, $scope.userDetail.id,{
                          motivo: motivoScope.params.motivo}).then(function(online) {
                                      clusterDetailScope.selectedMarker.setIcon('img/grey-dot.png');

                                      if (online) {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter('Bache marcado como no correspondiente en servidor');
                                        });
                                      } else {
                                        $timeout(function() {
                                          $cordovaToast.showLongCenter('Bache marcado como no correspondiente en dispositivo');
                                        });
                                      }
                           }, function(err) {
                          if (err.status == 401) {
                            $scope.handleTokenExpired();
                          } else {
                            $timeout(function() {
                              $cordovaToast.showShortCenter('Error marcando bache como no correspondiente: ' + errToStr(err));
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
       