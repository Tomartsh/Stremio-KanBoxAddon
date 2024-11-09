function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1)
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = constants.prefix_kanbox + retVal
    return retVal
}

function getNameFromSeriesPage(name){  
    if (name.indexOf("|") > 0){
        name = name.substring(0,name.indexOf("|") -1);
    }
    if (name.indexOf (" - פרקים מלאים לצפייה ישירה") > 0){
        name = name.substring(0,name.indexOf("-") - 1);
    }
    if (name.indexOf (" - פרקים לצפייה ישירה") > 0){
        name = name.substring(0,name.indexOf("-") - 1);
    }
    if (name.indexOf (" - פרקים מלאים") > 0){
        name = name.substring(0,name.indexOf("-") - 1);
    }
    if (name.indexOf ("- לצפייה ישירה") > 0){
        name = name.substring(0,name.indexOf("-"));
    }
    if (name.indexOf (" - סרט דוקו לצפייה") > 0){
        name = name.substring(0,name.indexOf("-") - 1);
    }
    if (name.indexOf (" - הסרט המלא לצפייה ישיר") > 0){
        name = name.substring(0,name.indexOf("-") - 1);
    }
    if (name.indexOf (" - תכניות מלאות לצפייה ישירה") > 0){
        name = name.substring(0,name.indexOf("-") - 1);
    }
 
    return name;
}
//+===================================================================================
//
//  Utility related code
//
//+===================================================================================
function writeLog(level, msg){
    if (level =="DEBUG"){
        console.log(msg)
    }
}

module.exports = {setID, writeLog};