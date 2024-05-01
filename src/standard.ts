import { Logging } from "./app/services/logging/logging.service";

let standardLoaded: boolean = false;

/**
 * Needs to be executed somewhere during the bootstrap process
 * in order to load the declarations in this module.
 *
 * For tests, call this function before you are loading the tests.
 * e.g. your shim.js
 *
 * For production, call this function in the bootstrap process
 * e.g. your main.ts
 */
export function useStandard(): void {
    if (standardLoaded) {
        return;
    }

    Logging.getLogger("useStandard").debug(() => "standard.ts loaded");
    Object.defineProperties(Object.prototype, {
        applies: {
            value: function <T>(block: () => void): T {
                block.apply(<T>this);
                return <T>this;
            },
            writable: true,
        },

        also: {
            value: function <T>(block: (it: T) => void): T {
                block(<T>this);
                return <T>this;
            },
            writable: true,
        },

        letIt: {
            value: function <T, R>(block: (it: T) => R): R {
                return block(<T>this);
            },
            writable: true,
        },

        takeIf: {
            value: function <T>(predicate: (it: T) => boolean): T | undefined {
                return predicate(<T>this) ? <T>this : undefined;
            },
            writable: true,
        },

        takeUnless: {
            value: function <T>(predicate: (it: T) => boolean): T | undefined {
                return predicate(<T>this) ? undefined : <T>this;
            },
            writable: true,
        },
    });
    standardLoaded = true;
}

declare global {
    interface Object {
        /**
         * Calls the specified function {@code block} with 'this' value and returns 'this' value.
         */
        applies<T>(block: (this: T) => void): T;

        /**
         * Calls the specified function {@code block} with 'this' value as its argument and returns 'this' value.
         */
        also<T>(block: (it: T) => void): T;

        /**
         * Calls the specified function {@code block} with 'this' value is its argument and returns its value.
         */
        letIt<T, R>(block: (it: T) => R): R;

        /**
         * Returns 'this' value if it satisfies the given {@code predicate} or 'undefined', if it doesn't.
         */
        takeIf<T>(predicate: (it: T) => boolean): T | undefined;

        /**
         * Returns 'this' value if it does not satisfy the given {@code predicate} or 'undefined', if it does.
         */
        takeUnless<T>(predicate: (it: T) => boolean): T | undefined;
    }
}
