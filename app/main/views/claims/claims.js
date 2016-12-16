ionicApp.controller('addFlightCtrl', ['$scope','Ether',
function($scope,Ether){
    $scope.$on('$ionicView.beforeEnter', function(){

    });

    $scope.claim = function(){
        window.mdc.claim(userFlight.flight.flightNumber, userFlight.flight.departureTime, userFlight.user.name, userFlight.user.country, userFlight.user.id, userFlight.user.noncestr, { from: userFlight.user.account, gas: 1000000, gasPrice: 20000000000 }).then(function (transactionId) {
            console.log('Claim transaction ID: ', '' + transactionId);
        }).catch(function(err){
            console.log(err);
        });
    }
}])
;
