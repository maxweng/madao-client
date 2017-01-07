ionicApp.controller('addFlightCtrl', ['$scope','$state','Ether','web3Provider','Wallet','Wechat','Me','$ionicLoading','tools','walletManage','ethUnits','$ionicPopup','$q','walletManage',
function($scope,$state,Ether,web3Provider,Wallet,Wechat,Me,$ionicLoading,tools,walletManage,ethUnits,$ionicPopup,$q,walletManage){
    $scope.$on('$ionicView.beforeEnter', function(){
        Me.get().$promise.then(function(me){
            walletManage($scope, function(modal){
                $scope.modal = modal;
            });
            $scope.me = me;
            if(!window.mdc)web3Provider.init($scope.me.address,'');
            $scope.get();
            checkBalance();
        },function(err){
            web3Provider.init("","",true);
            $scope.get();
        })
    });

    $scope.data = {};

    var transInt = function(value){return +value};
    var transUtf8 = function(value){return window.web3.toUtf8(value)};
    var transString = function(value){return "" + value};
    var transEther = function(value){return +window.web3.fromWei(value, "ether")};
    var transBool = function(value){return !!value};
    function getFlights(address, cb){
        window.mdc.getFlightCount.call(address).then(function (count) {
            count = transInt(count);
            var flights = [];
            var work = function(i, work_cb){
                if(i >= count) return work_cb();
                window.mdc.flights.call(address, i).then(function (res) {
                    var flight = {
                        "_id": i+1,
                        "flightNumber": transUtf8(res[0]),
                        "departureTime": transInt(res[1]),
                        "queryNo": transString(res[2]),
                        "claimed": transBool(res[3]),
                    };
                    if(flight.claimed){
                        window.mdc.claimIds(address,i+1).then(function(res1){
                            window.mdc.claims(res1.toNumber()).then(function(res2){
                                flight.claimStatus = transInt(res2[8]);
                                flights.push(flight);
                                i++;
                                work(i, work_cb);
                            });
                        });
                    }else{
                        flights.push(flight);
                        i++;
                        work(i, work_cb);
                    }
                }).catch(function(err){
                    $ionicLoading.hide();
                    console.log(err);
                });
            }
            work(0, function(){
                cb(flights);
            });
        }).catch(function(err){
            $ionicLoading.hide();
            console.log(err);
        });
    }

    $scope.get = function(){
        $ionicLoading.show();
        getFlights($scope.$root.address,function(res){
            $scope.flights = res.reverse();
            // if($scope.flights.length == 0)alert("暂无记录")
            $ionicLoading.hide();
            $scope.$broadcast('scroll.refreshComplete');
            $scope.$apply()
        })
    }

    var decryptWallet = function(){
        var deferred = $q.defer();
        if(!$scope.me||!$scope.me.encrypted_wallet_key){
            if($scope.modal)$scope.modal.showModal();
            deferred.resolve(true);
        }else if(window.mdc&&$scope.$root.address&&$scope.$root.privateKey){
            deferred.resolve(false);
        }else{
            var wallet;
            $ionicPopup.prompt({
                title: $scope.$root.language.tip10,
                inputType: 'password',
                okText: $scope.$root.language.ok,
                cancelText: $scope.$root.language.cancel
            }).then(function(str){
                if(str){
                    try {
                        wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, str);
                    } catch (e) {
                        alert(e)
                        return true;
                    }
                    web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
                    return false;
                }else{
                    return true;
                }
            }).then(function(result){
                deferred.resolve(result);
            });
        }

        // var str=prompt($scope.$root.language.tip10,"");
        return deferred.promise;
    };

    var checkBalance = function(){
        var mixEth = parseInt(ethUnits.toEther(1000000*20000000000,'wei'));
        Ether.getBalance({'balance':$scope.me.address,'isClassic':true}).$promise.then(function(res){
            if(parseInt(ethUnits.toEther(res.data.balance,'wei'))<mixEth)$scope.balanceInsufficient = true;
        },function(msg){
            alert(JSON.stringify(msg));
        })
    }

    $scope.add = function(){
        decryptWallet().then(function(result){
            if(!result){
                var dateTime = Math.floor((new Date($scope.data.departureTime).getTime()/1000)/86400)*86400;
                var nowTime = new Date().getTime()/1000+1800;

                if(!$scope.data.flightNumber||!$scope.data.departureTime){
                    alert($scope.$root.language.errMsg1);
                    return;
                }else if(dateTime<=nowTime){
                    alert($scope.$root.language.errMsg2);
                    return;
                }
                var userFlight = {
                    user: {
                        account: $scope.$root.address
                    },
                    flight: {
                        flightNumber: $scope.data.flightNumber,
                        departureTime: parseInt(new Date($scope.data.departureTime).getTime()/1000)
                    }
                }
                $ionicLoading.show();
                if($scope.balanceInsufficient){
                    alert($scope.$root.language.errMsg17);
                    return;
                }
                window.mdc.addFlight(userFlight.flight.flightNumber, userFlight.flight.departureTime, { from: userFlight.user.account, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
                    console.log('Add flight transaction ID: ', '' + transactionId);
                    checkBalance();
                    Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                        $ionicLoading.hide();
                        if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                            alert($scope.$root.language.tipMsg1)
                        }else{
                            alert($scope.$root.language.tipMsg2)
                        }
                        $scope.get()
                    },function(err){
                        $ionicLoading.hide();
                        alert(err.message);
                    });
                }).catch(function(err){
                    $ionicLoading.hide();
                    alert($scope.$root.language.errMsg3);
                    console.log(err);
                });
            }
        });
    }

    $scope.claim = function(id){
        decryptWallet().then(function(result){
            if(!result){
                if($scope.balanceInsufficient){
                    alert($scope.$root.language.errMsg17);
                    return;
                }
                $ionicLoading.show()
                window.mdc.infoHashes.call($scope.$root.address).then(function (res) {
                    var infoHash = transString(res[0]);
                    var available = transBool(res[1]);
                    if(available){
                        window.mdc.claim(id, $scope.me.real_name, $scope.me.country, tools.hexEncode($scope.me.id_no), tools.noncestr($scope.$root.address), { from: $scope.$root.address, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
                            console.log('Claim transaction ID: ', '' + transactionId);
                            checkBalance();
                            Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                                $ionicLoading.hide();
                                console.log(res);
                                if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                                    alert($scope.$root.language.tipMsg1)
                                }else{
                                    alert($scope.$root.language.tipMsg3)
                                }
                                $scope.get();
                            },function(err){
                                $ionicLoading.hide();
                                alert(err.message);
                            });
                        }).catch(function(err){
                            $ionicLoading.hide();
                            console.log(err);
                            alert($scope.$root.language.errMsg4)
                        });
                    }else{
                        $ionicLoading.hide();
                        alert($scope.$root.language.errMsg5)
                    }
                }).catch(function(err){
                    $ionicLoading.hide();
                    console.log(err);
                    alert($scope.$root.language.errMsg6)
                });
            }
        });
    }
}])
;
