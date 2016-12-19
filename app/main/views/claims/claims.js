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
        web3Provider.init("","");
    });
    $scope.data = {};
    var userFlight = null;
    var transInt = function(value){return +value};
    var transUtf8 = function(value){return web3.toUtf8(value)};
    var transString = function(value){return "" + value};
    var transEther = function(value){return +web3.fromWei(value, "ether")};
    var transBool = function(value){return !!value};

    $scope.getInfo = function(){
        window.mdc.claims.call($scope.$root.address).then(function (res) {
            alert(transInt(res[8]))
        }).catch(function(err){
            alert(JSON.stringify(err))
        });
    }

    $scope.claim = function(){
        if(!userFlight)
        userFlight = {
            user: {
                account: $scope.$root.address,
                name: "twy",
                country: "China",
                id: tools.hexEncode("310104000000000000"),
                noncestr: tools.noncestr($scope.$root.address)
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
                        if(res.data.transactionIndex==0){
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
