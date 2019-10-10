var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DemoStore = /** @class */ (function () {
    function DemoStore() {
        this.observedArray = ["foo", "bar", "hoo", "hee"];
    }
    __decorate([
        mobx.observable
    ], DemoStore.prototype, "observedArray");
    return DemoStore;
}());
var demoStoreInstance = new DemoStore();
console.log(demoStoreInstance.observedArray);
function New(fn) {
    // this is actually not the complete implementation of new,
    // but this helps to understand what does new do
    var instance = { __proto__: fn.prototype };
    fn.apply(instance, Array.prototype.slice.call(arguments, 1));
    return instance;
}
var demoStoreInstance1 = New(DemoStore);
console.log(demoStoreInstance1 instanceof DemoStore); // result: true
