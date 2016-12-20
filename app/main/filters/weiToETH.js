ionicApp.filter('weiToETH', ['ethUnits',function(ethUnits){
    return function(wei){
        if(!wei) return;
        return ethUnits.toEther(wei, 'wei');
    }
}])
;
