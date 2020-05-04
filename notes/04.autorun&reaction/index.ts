class DemoStore {
  @mobx.observable
  observedArray = ["a", "b", "c", "d"];
}
const demoStoreInstance = new DemoStore();

console.log(demoStoreInstance.observedArray);

const reaction1 = mobx.autorun((reaction) =>
  console.log(demoStoreInstance.observedArray.join(","))
);

const reaction2 = mobx.reaction(
  () => demoStoreInstance.observedArray.length,
  (length, reaction) => {
    console.log({ length, reaction });
  }
);

demoStoreInstance.observedArray[1] = "b1";
demoStoreInstance.observedArray.push("e");
demoStoreInstance.observedArray = ["a2", "b2", "c2", "d2"];
