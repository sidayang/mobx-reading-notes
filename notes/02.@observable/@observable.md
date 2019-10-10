# Mobx Source Code Reading Note 2

## @observable decorator

### Notice

To make this note more clear to get understood, noncritical codes in some functions may be truncated. Complete codes can be found via those hyperlinks.

### Demo

```ts
class DemoStore1 {
  observedArray = ["foo", "bar", "hoo", "hee"];
}

class DemoStore {
  @mobx.observable
  observedArray = ["foo", "bar", "hoo", "hee"];
}
console.log(DemoStore.prototype);
console.log(DemoStore1.prototype);
```

Where is `observable` decorator from

[src/api/observable.ts#L203](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/observable.ts#L203)

```ts
export const observable: IObservableFactory &
  IObservableFactories & {
    enhancer: IEnhancer<any>;
  } = createObservable as any;
```

[src/api/observable.ts#L80](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/observable.ts#L80)

```ts
function createObservable(v: any, arg2?: any, arg3?: any) {
  // @observable someProp;
  if (typeof arguments[1] === "string") {
    return deepDecorator.apply(null, arguments as any);
  }
}
```

`arg2` would the name of decorated property, here, is `"observedArray"`, based on [TypeScript's implementation of decorators](https://www.typescriptlang.org/docs/handbook/decorators.html#property-decorators)

[src/api/observable.ts#L63](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/observable.ts#L63)

```ts
export const deepDecorator = createDecoratorForEnhancer(deepEnhancer);
```

Here, the `deepEnhancer` is the same with the one in the [reading note of `observable` function](../01.observable/observable.md).

[src/api/observabledecorator.ts#L16](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/observabledecorator.ts#L16)

```ts
export function createDecoratorForEnhancer(
  enhancer: IEnhancer<any>
): IObservableDecorator {
  const decorator = createPropDecorator(
    true,
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
    }
  );
  const res: any = decorator;
  res.enhancer = enhancer;
  return res;
}
```

[src/utils/decorators.ts#L67](https://github.com/mobxjs/mobx/blob/5.13.0/src/utils/decorators.ts#L67)

```ts
export function createPropDecorator(
  propertyInitiallyEnumerable: boolean,
  propertyCreator: PropertyCreator
) {
  return function decoratorFactory() {
    let decoratorArguments: any[];

    const decorator = function decorate(
      target: DecoratorTarget,
      prop: string,
      descriptor: BabelDescriptor | undefined,
      applyImmediately?: any
      // This is a special parameter to signal the direct application of a decorator, allow extendObservable to skip the entire type decoration part,
      // as the instance to apply the decorator to equals the target
    ) {
      if (applyImmediately === true) {
        propertyCreator(target, prop, descriptor, target, decoratorArguments);
        return null;
      }
      if (
        !Object.prototype.hasOwnProperty.call(target, mobxPendingDecorators)
      ) {
        const inheritedDecorators = target[mobxPendingDecorators];
        addHiddenProp(target, mobxPendingDecorators, {
          ...inheritedDecorators
        });
      }
      target[mobxPendingDecorators]![prop] = {
        prop,
        propertyCreator,
        descriptor,
        decoratorTarget: target,
        decoratorArguments
      };
      return createPropertyInitializerDescriptor(
        prop,
        propertyInitiallyEnumerable
      );
    };

    if (quacksLikeADecorator(arguments)) {
      // @decorator
      decoratorArguments = EMPTY_ARRAY;
      return decorator.apply(null, arguments as any);
    } else {
      // @decorator(args)
      decoratorArguments = Array.prototype.slice.call(arguments);
      return decorator;
    }
  } as Function;
}
```

So the `@observable` docorator we use is actually this `decoratorFactory` function, and when we call

```ts
class DemoStore {
  @observable
  observedArray = ["foo", "bar", "hoo", "hee"];
}
```

this `decorate` function would be called, meanwhile all arguments as follow:

1. `target` is `DemoStore.prototype`
2. `prop` is `"observedArray"`
3. `descriptor` and `applyImmediately` are `undefined`

```ts
const decorator = function decorate(
  target: DecoratorTarget,
  prop: string,
  descriptor: BabelDescriptor | undefined,
  applyImmediately?: any
  // This is a special parameter to signal the direct application of a decorator, allow extendObservable to skip the entire type decoration part,
  // as the instance to apply the decorator to equals the target
) {
  if (applyImmediately === true) {
    propertyCreator(target, prop, descriptor, target, decoratorArguments);
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(target, mobxPendingDecorators)) {
    const inheritedDecorators = target[mobxPendingDecorators];
    addHiddenProp(target, mobxPendingDecorators, {
      ...inheritedDecorators
    });
  }
  target[mobxPendingDecorators]![prop] = {
    prop,
    propertyCreator,
    descriptor,
    decoratorTarget: target,
    decoratorArguments
  };
  return createPropertyInitializerDescriptor(prop, propertyInitiallyEnumerable);
};
```

The return value of `createPropertyInitializerDescriptor(prop, propertyInitiallyEnumerable)` will be assigned as property descriptor of property `observedArray`, although the official doc says the return value of property decorators would be ignored. Here is the [issue](https://github.com/microsoft/TypeScript/issues/32395) of the official doc, and the [transpiled js code](./index.js#1) of decorator proves this point as well.

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
