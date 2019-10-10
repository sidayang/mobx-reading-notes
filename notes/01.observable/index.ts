const originalArray = ["foo", "bar", "hoo", "hee"];
const observedArray = mobx.observable(originalArray);
console.log("originalArray", originalArray);
console.log("observedArray", observedArray);
