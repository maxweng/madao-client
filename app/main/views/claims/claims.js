ionicApp.controller('claimsCtrl', ['$scope','$state','Ether','Me','tools','web3Provider','Wechat','Wallet','$ionicLoading','walletManage',
function($scope,$state,Ether,Me,tools,web3Provider,Wechat,Wallet,$ionicLoading,walletManage){
    $scope.$on('$ionicView.beforeEnter', function(){
        walletManage($scope, function(modal){
            $scope.modal = modal;
        });
        Me.get().$promise.then(function(me){
            $scope.me = me;
            if(!window.mdc)web3Provider.init($scope.me.address,'');
            $scope.getClaims();
        },function(err){
            web3Provider.init("","",true);
            $scope.getClaims();
        })
    });

    var hexDecode = function(input){
        var j;
        var hexes = input.match(/.{1,4}/g) || [];
        var back = "";
        for(j = 0; j<hexes.length; j++) {
            back += String.fromCharCode(parseInt(hexes[j], 16));
        }

        return back;
    }

    var safeUtf8 = function(input){
        if(input.slice(0,2) == '0x'){
            input = input.slice(2);
        }
        try{
            return web3.toUtf8(input);
        }catch(e){
            return hexDecode(input);
        }
    }

    $scope.data = {};
    var userFlight = null;
    var transInt = function(value){return +value};
    var transUtf8 = function(value){return web3.toUtf8(value)};
    var transSafeUtf8 = safeUtf8;
    var transAscii = function(value){return web3.toAscii(value)};
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
                        "claimerName": transSafeUtf8(res[1]),
                        "claimerCountry": transSafeUtf8(res[2]),
                        "claimerId": transAscii(res[3]),
                        "claimerNoncestr": transAscii(res[4]),
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
            console.log(err)
            $ionicLoading.hide();
        })
    }

    $scope.getClaims = function(){
        $ionicLoading.show()
        getInfo($scope.$root.address,function(res){
            $scope.claims = res.reverse();
            // if($scope.claims.length == 0)alert("暂无记录")
            $ionicLoading.hide();
            $scope.$broadcast('scroll.refreshComplete');
            $scope.$apply()
        })
    }
}])
;
