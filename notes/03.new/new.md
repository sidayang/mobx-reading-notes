# Mobx Source Code Reading Note 3

## new

### Notice

To make this note more clear to get understood, noncritical codes in some functions may be truncated. Complete codes can be found via those hyperlinks.

### Demo

```ts
class DemoStore {
  @mobx.observable
  observedArray = ["foo", "bar", "hoo", "hee"];
}
const demoStoreInstance = new DemoStore();
console.log(demoStoreInstance.observedArray);
```

#### What does new do?

```ts
function New(fn: Function) {
  // this is actually not the complete implementation of new,
  // but this is enough for understanding what does new do
  const instance = { __proto__: fn.prototype };
  fn.apply(instance, Array.prototype.slice.call(arguments, 1));
  return instance;
}

const demoStoreInstance1 = New(DemoStore);
console.log(demoStoreInstance1 instanceof DemoStore); // result: true
```

What does `new` do is shown in `New` function, an instance of DemoStore `instance` is created and `this.observedArray = ["foo", "bar", "hoo", "hee"];` in [index.js#9](./index.js#9) is exactly `instance.observedArray = ["foo", "bar", "hoo", "hee"];`, where the property descripter [index.js#9](./index.js#9) get called.

[src/utils/decorators.ts#L32](https://github.com/mobxjs/mobx/blob/5.13.0/src/utils/decorators.ts#L32)

```ts
function createPropertyInitializerDescriptor(
  prop: string,
  enumerable: boolean
): PropertyDescriptor {
  const cache = enumerable
    ? enumerableDescriptorCache
    : nonEnumerableDescriptorCache;
  return (
    cache[prop] ||
    (cache[prop] = {
      configurable: true,
      enumerable: enumerable,
      get() {
        initializeInstance(this);
        return this[prop];
      },
      set(value) {
        initializeInstance(this);
        this[prop] = value;
      }
    })
  );
}
```

[src/utils/decorators.ts#L55](https://github.com/mobxjs/mobx/blob/5.13.0/src/utils/decorators.ts#L55)

```ts
export function initializeInstance(target: DecoratorTarget) {
  if (target[mobxDidRunLazyInitializersSymbol] === true) return;
  const decorators = target[mobxPendingDecorators];
  if (decorators) {
    addHiddenProp(target, mobxDidRunLazyInitializersSymbol, true);
    for (let key in decorators) {
      const d = decorators[key];
      d.propertyCreator(
        target,
        d.prop,
        d.descriptor,
        d.decoratorTarget,
        d.decoratorArguments
      );
    }
  }
}
```

arguments passed to `propertyCreator` function as follow:

1. `target` is `demoStoreInstance`
2. `prop` is `"observedArray"`
3. `descriptor` is `undefined`
4. `decoratorTarget` is `DemoStore.protoType`
5. `decoratorArguments` is `[]`

and `propertyCreator` is

[src/api/observabledecorator.ts#L20](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/observabledecorator.ts#L20)

```ts
(
  target: any,
  propertyName: PropertyKey,
  descriptor: BabelDescriptor | undefined,
  _decoratorTarget,
  decoratorArgs: any[]
) => {
  const initialValue = descriptor
    ? descriptor.initializer
      ? descriptor.initializer.call(target)
      : descriptor.value
    : undefined;
  asObservableObject(target).addObservableProp(
    propertyName,
    initialValue,
    enhancer
  );
};
```

[src/types/observableobject.ts#L328](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L328)

```ts
export function asObservableObject(
  target: any,
  name: PropertyKey = "",
  defaultEnhancer: IEnhancer<any> = deepEnhancer
): ObservableObjectAdministration {
  if (Object.prototype.hasOwnProperty.call(target, $mobx)) return target[$mobx];

  process.env.NODE_ENV !== "production" &&
    invariant(
      Object.isExtensible(target),
      "Cannot make the designated object observable; it is not extensible"
    );
  if (!isPlainObject(target))
    name = (target.constructor.name || "ObservableObject") + "@" + getNextId();
  if (!name) name = "ObservableObject@" + getNextId();

  const adm = new ObservableObjectAdministration(
    target,
    new Map(),
    stringifyKey(name),
    defaultEnhancer
  );
  addHiddenProp(target, $mobx, adm);
  return adm;
}
```

create a singleton instance under `$mobx` property of constructor of `DemoStore` class

[src/types/observableobject.ts#L160](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L160)

```ts
export class ObservableObjectAdministration
  implements IInterceptable<IObjectWillChange>, IListenable {
  keysAtom: IAtom;
  changeListeners;
  interceptors;
  private proxy: any;
  private pendingKeys: undefined | Map<PropertyKey, ObservableValue<boolean>>;

  constructor(
    public target: any,
    public values = new Map<
      PropertyKey,
      ObservableValue<any> | ComputedValue<any>
    >(),
    public name: string,
    public defaultEnhancer: IEnhancer<any>
  ) {
    this.keysAtom = new Atom(name + ".keys");
  }

  addObservableProp(
    propName: PropertyKey,
    newValue,
    enhancer: IEnhancer<any> = this.defaultEnhancer
  ) {
    const { target } = this;
    assertPropertyConfigurable(target, propName);

    if (hasInterceptors(this)) {
      const change = interceptChange<IObjectWillChange>(this, {
        object: this.proxy || target,
        name: propName,
        type: "add",
        newValue
      });
      if (!change) return;
      newValue = (change as any).newValue;
    }
    const observable = new ObservableValue(
      newValue,
      enhancer,
      `${this.name}.${stringifyKey(propName)}`,
      false
    );
    this.values.set(propName, observable);
    newValue = (observable as any).value; // observableValue might have changed it

    Object.defineProperty(
      target,
      propName,
      generateObservablePropConfig(propName)
    );
    this.notifyPropertyAddition(propName, newValue);
  }
}
```

[src/types/observableobject.ts#L357](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L357)

```ts
export function generateObservablePropConfig(propName) {
  return (
    observablePropertyConfigs[propName] ||
    (observablePropertyConfigs[propName] = {
      configurable: true,
      enumerable: true,
      get() {
        return this[$mobx].read(propName);
      },
      set(v) {
        this[$mobx].write(propName, v);
      }
    })
  );
}
```

[src/types/observableobject.ts#L93](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L93)

```ts
export class ObservableObjectAdministration
    implements IInterceptable<IObjectWillChange>, IListenable {
    keysAtom: IAtom
    changeListeners
    interceptors
    private proxy: any
    private pendingKeys: undefined | Map<PropertyKey, ObservableValue<boolean>>

    constructor(
        public target: any,
        public values = new Map<PropertyKey, ObservableValue<any> | ComputedValue<any>>(),
        public name: string,
        public defaultEnhancer: IEnhancer<any>
    ) {
        this.keysAtom = new Atom(name + ".keys")
    }

    read(key: PropertyKey) {
        return this.values.get(key)!.get()
    }

    write(key: PropertyKey, newValue) {
        const instance = this.target
        const observable = this.values.get(key)
        if (observable instanceof ComputedValue) {
            observable.set(newValue)
            return
        }

        // intercept
        if (hasInterceptors(this)) {
            const change = interceptChange<IObjectWillChange>(this, {
                type: "update",
                object: this.proxy || instance,
                name: key,
                newValue
            })
            if (!change) return
            newValue = (change as any).newValue
        }
        newValue = (observable as any).prepareNewValue(newValue)

        // notify spy & observers
        if (newValue !== globalState.UNCHANGED) {
            const notify = hasListeners(this)
            const notifySpy = isSpyEnabled()
            const change =
                notify || notifySpy
                    ? {
                          type: "update",
                          object: this.proxy || instance,
                          oldValue: (observable as any).value,
                          name: key,
                          newValue
                      }
                    : null

            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart({ ...change, name: this.name, key })
            ;(observable as ObservableValue<any>).setNewValue(newValue)
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        }
    }
```
