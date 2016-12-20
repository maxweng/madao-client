ionicApp.controller('claimsCtrl', ['$scope','Ether','Me','tools','web3Provider',
function($scope,Ether,Me,tools,web3Provider){
    $scope.$on('$ionicView.beforeEnter', function(){
        Me.get().$promise.then(function(me){
            userFlight = {
                user: {
                    account: $scope.$root.address,
                    name: me.real_name,
                    country: me.country,
                    id: tools.hexEncode(me.id_no),
                    noncestr: tools.noncestr($scope.$root.address)
                },
                flight:{}
            }
        },function(err){
            alert(err.message)
        })
        // web3Provider.init("","");
    });
    $scope.data = {};
    var userFlight = null;
    var transInt = function(value){return +value};
    var transUtf8 = function(value){return web3.toUtf8(value)};
    var transString = function(value){return "" + value};
    var transEther = function(value){return +web3.fromWei(value, "ether")};
    var transBool = function(value){return !!value};

    var getInfo = function(address,cb){
        var claims = [];
        window.mdc.totalClaims.call(address).then(function (totalClaims) {
            totalClaims = +totalClaims;
            var work = function(i, work_cb){
                if(i > totalClaims){
                    return work_cb();
                }
                window.mdc.claims.call(i).then(function (res) {
                    claims.push({
                        "_id": i,
                        "claimer": transString(res[0]),
                        "claimerName": transUtf8(res[1]),
                        "claimerCountry": transUtf8(res[2]),
                        "claimerId": transUtf8(res[3]),
                        "claimerNoncestr": transUtf8(res[4]),
                        "flightNumber": transUtf8(res[5]),
                        "departureTime": transInt(res[6]),
                        "oracleItId": transInt(res[7]),
                        "status": transInt(res[8]),
                    });
                    i++;
                    work(i, work_cb);
                }).catch(function(err){
                    console.log(err);
                });
            }
            work(1, function(){
                console.log("MDC claims: ", claims);
                cb(claims);
            });
        }).catch(function(err){
            alert(JSON.stringify(err))
        })
    }

    $scope.getClaims = function(){
        getInfo($scope.$root.address,function(res){
            alert(JSON.stringify(res))
        })
    }

    $scope.claim = function(){
        if(!userFlight)
        userFlight = {
            user: {
                // account: $scope.$root.address,
                // name: "twy",
                // country: "China",
                // id: tools.hexEncode("310104000000000000"),
                // noncestr: tools.noncestr($scope.$root.address)
            },
            flight:{}
        }

        userFlight.flight.flightNumber = $scope.data.flightNumber;
        userFlight.flight.departureTime = parseInt(new Date($scope.data.departureTime).getTime()/1000);
        window.mdc.infoHashes.call($scope.$root.address).then(function (res) {
            var infoHash = transString(res[0]);
            var available = transBool(res[1]);
            if(available){
                console.log(userFlight)
                window.mdc.claim(userFlight.flight.flightNumber, userFlight.flight.departureTime, userFlight.user.name, userFlight.user.country, userFlight.user.id, userFlight.user.noncestr, { from: userFlight.user.account, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
                    console.log('Claim transaction ID: ', '' + transactionId);
                    Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                        console.log(res);
                        if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                            alert("正在处理，可能需要几分钟请稍等")
                        }else if(res.data.transactionIndex==0){
                            alert("申请成功")
                        }else{
                            alert("申请失败")
                        }
                    },function(err){
                        alert(err.message);
                    });
                }).catch(function(err){
                    console.log(err);
                    alert("申请失败")
                });
            }else{
                alert('没有理赔资格')
            }
        }).catch(function(err){
            console.log(err);
            alert('获取用户信息失败')
        });
    }
}])
;
