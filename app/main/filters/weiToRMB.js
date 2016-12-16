ionicApp.filter('weiToRMB', ['ethUnits',function(ethUnits){
    return function(wei,advicedPrice){
        if(!wei) return;
        var price = advicedPrice*ethUnits.toEther(wei, 'wei');
        return price;
    }
}])
;
