ionicApp.controller('addFlightCtrl', ['$scope','$state','Ether','web3Provider','Wallet','Wechat',
function($scope,$state,Ether,web3Provider,Wallet,Wechat){
    $scope.$on('$ionicView.beforeEnter', function(){
        if(!window.mdc){
            Me.get().$promise.then(function(res){
                $scope.me = res;
                var wallet;
                var str=prompt("请先解锁钱包","密码");
                if(str){
                    try {
                        wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, parseInt(str));
            		} catch (e) {
            			alert(e)
                        $state.go("app.tabs.me")
            		}
                    web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
                }else{
                    $state.go("app.tabs.me")
                }
            },function(err){
                Wechat.loginWechat(function(){
                    console.log('登录成功')
                },function(msg){
                    console.log(msg)
                });
            })
        }
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
                        "_id": i,
                        "flightNumber": transUtf8(res[0]),
                        "departureTime": transInt(res[1]),
                        "queryNo": transString(res[2]),
                        "claimed": transBool(res[3]),
                    };
                    flights.push(flight);
                    i++;
                    work(i, work_cb);
                }).catch(function(err){
                    console.log(err);
                });
            }
            work(0, function(){
                cb(flights);
            });
        }).catch(function(err){
            console.log(err);
        });
    }

    $scope.get = function(){
        getFlights($scope.$root.address,function(res){
            $scope.flights = res;
            if($scope.flights.length == 0)alert("暂无记录")
            $scope.$apply()
        })
    }

    $scope.add = function(){
        if(!$scope.data.flightNumber||!$scope.data.departureTime){
            alert("请输入航班号和起飞时间");
            return;
        }else if(!new Date($scope.data.departureTime) || new Date($scope.data.departureTime)<new Date()){
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
        console.log(userFlight)
        window.mdc.addFlight(userFlight.flight.flightNumber, userFlight.flight.departureTime, { from: userFlight.user.account, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
            console.log('Add flight transaction ID: ', '' + transactionId);
            Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                    alert("正在处理，可能需要几分钟请稍等")
                }else{
                    alert("登记成功")
                }
            },function(err){
                alert(err.message);
            });
        }).catch(function(err){
            alert('登记失败');
            console.log(err);
        });
    }
}])
;
