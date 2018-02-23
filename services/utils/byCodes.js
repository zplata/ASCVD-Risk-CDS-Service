const byCode = (obs, prop) => {
  console.log("3");
  var ret = {};
  if (!Array.isArray(obs)){
    obs = [obs];
  }
  obs.forEach(function(o){
    if (o.resourceType === "Observation"){
      if (o[prop] && Array.isArray(o[prop].coding)) {
        o[prop].coding.forEach(function (coding){
          ret[coding.code] = ret[coding.code] || [];
          ret[coding.code].push(o);
        });
      }
    }
  });
  return ret;
};

const byCodes = (obs, property) => {
  var bank = byCode(obs, property);
  function byCodes(){
    var ret = [];
    for (var i=0; i<arguments.length;i++){
      var set = bank[arguments[i]];
      if (set) {[].push.apply(ret, set);}
    }
    return ret;
  }

  return byCodes;
};

module.exports = byCodes;