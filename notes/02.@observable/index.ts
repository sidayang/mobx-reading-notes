class DemoStore1 {
  observedArray = ["foo", "bar", "hoo", "hee"];
}

class DemoStore {
  @mobx.observable
  observedArray = ["foo", "bar", "hoo", "hee"];
}
console.log(DemoStore.prototype);
console.log(DemoStore1.prototype);
