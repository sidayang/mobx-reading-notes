class DemoStore {
  @mobx.observable
  observedArray = ["foo", "bar", "hoo", "hee"];
}
const demoStoreInstance = new DemoStore();
console.log(demoStoreInstance.observedArray);

function New(fn: Function) {
  // this is actually not the complete implementation of new,
  // but this helps to understand what does new do
  const instance = { __proto__: fn.prototype };
  fn.apply(instance, Array.prototype.slice.call(arguments, 1));
  return instance;
}

const demoStoreInstance1 = New(DemoStore);
console.log(demoStoreInstance1 instanceof DemoStore); // result: true
