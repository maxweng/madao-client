ionicApp.controller('addFlightCtrl', ['$scope','$state','Ether','web3Provider','Wallet','Wechat','Me','$ionicLoading','tools',
function($scope,$state,Ether,web3Provider,Wallet,Wechat,Me,$ionicLoading,tools){
    $scope.$on('$ionicView.beforeEnter', function(){
        Me.get().$promise.then(function(me){
            $scope.me = me;
            if(!window.mdc)web3Provider.init($scope.me.address,'');
            $scope.get();
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
        if(!$scope.me||!$scope.me.encrypted_wallet_key){
            $state.go("app.tabs.me");
            return true;
        }
        if(window.mdc&&$scope.$root.address&&$scope.$root.privateKey){
            return false;
        }
        var wallet;
        var str=prompt("请先解锁钱包","");
        if(str){
            try {
                wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, str);
            } catch (e) {
                alert(e)
                $state.go("app.tabs.me")
            }
            web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
            return false;
        }else{
            $state.go("app.tabs.me")
            return true;
        }
    }

    $scope.add = function(){
        if(decryptWallet())return;
        var dateTime = Math.floor((new Date($scope.data.departureTime).getTime()/1000)/86400)*86400;
        var nowTime = new Date().getTime()/1000+1800;

        if(!$scope.data.flightNumber||!$scope.data.departureTime){
            alert("请输入航班号和起飞时间");
            return;
        }else if(dateTime<=nowTime){
            alert("起飞时间不正确");
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
        window.mdc.addFlight(userFlight.flight.flightNumber, userFlight.flight.departureTime, { from: userFlight.user.account, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
            console.log('Add flight transaction ID: ', '' + transactionId);
            Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                $ionicLoading.hide();
                if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                    alert("正在处理，可能需要几分钟请稍等")
                }else{
                    alert("登记成功")
                }
                $scope.get()
            },function(err){
                $ionicLoading.hide();
                alert(err.message);
            });
        }).catch(function(err){
            $ionicLoading.hide();
            alert('登记失败');
            console.log(err);
        });
    }

    $scope.claim = function(id){
        if(decryptWallet())return;
        $ionicLoading.show()
        window.mdc.infoHashes.call($scope.$root.address).then(function (res) {
            var infoHash = transString(res[0]);
            var available = transBool(res[1]);
            if(available){
                window.mdc.claim(id, $scope.me.real_name, $scope.me.country, tools.hexEncode($scope.me.id_no), tools.noncestr($scope.$root.address), { from: $scope.$root.address, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
                    console.log('Claim transaction ID: ', '' + transactionId);
                    Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                        $ionicLoading.hide();
                        console.log(res);
                        if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                            alert("正在处理，可能需要几分钟请稍等")
                        }else{
                            alert("申请成功")
                        }
                        $scope.get();
                    },function(err){
                        $ionicLoading.hide();
                        alert(err.message);
                    });
                }).catch(function(err){
                    $ionicLoading.hide();
                    console.log(err);
                    alert("申请失败")
                });
            }else{
                $ionicLoading.hide();
                alert('没有理赔资格')
            }
        }).catch(function(err){
            $ionicLoading.hide();
            console.log(err);
            alert('获取用户信息失败')
        });
    }
}])
;
