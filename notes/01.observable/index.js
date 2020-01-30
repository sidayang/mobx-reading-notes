"use strict";
var originalArray = ["foo", "bar", "hoo", "hee"];
var observedArray = mobx.observable(originalArray);
console.log("originalArray", originalArray);
console.log("observedArray", observedArray);
