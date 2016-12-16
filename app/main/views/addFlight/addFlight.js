ionicApp.controller('addFlightCtrl', ['$scope','Ether','web3Provider',
function($scope,Ether,web3Provider){
    $scope.$on('$ionicView.beforeEnter', function(){
        var wallet = '0x038036734702226a9e2731d061683856ea673967';
        var privateKey = '9c5218266a996fda3f18905532a632a5ec748bff5808dd89716f1047413dcbbf';
        web3Provider.init(wallet,privateKey);
        Ether.getBalance({'balance':$scope.$root.address,'isClassic':true}).$promise.then(function(res){

            console.log(res)
        });
    });

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
            alert(JSON.stringify(res))
        })
    }

    $scope.add = function(){
        var userFlight = {
            user: {
                account: $scope.$root.address,
                // name: "test name",
                // country: "China",
                // id: hexEncode("310110198501081234"),
                // noncestr: "a1seb25f5q",
                // recommender: accounts[1],
            },
            flight: {
                flightNumber: "FN8595",
                departureTime: parseInt(Date.now() / 1000 + 3600)
            }
        }

        window.mdc.addFlight(userFlight.flight.flightNumber, userFlight.flight.departureTime, { from: userFlight.user.account, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
            console.log('Add flight transaction ID: ', '' + transactionId);
            alert('登记成功')
        }).catch(function(err){
            console.log(err);
        });
    }
}])
;
