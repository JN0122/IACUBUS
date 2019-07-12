import { isDefined } from "./util/util.function";
import { isFunction } from "util";
//import {isDevMode as isAngularDevMode} from "@angular/core";
/**
 * Returns true if the dev mode is enabled, otherwise returns false.
 *
 * The app is considered to run in dev mode if one of the following conditions are met:
 * - If the ionic dev server is running
 * - If the angular dev mode is enabled.
 *
 * @returns {boolean} true if the pegasus dev mode is enabled, otherwise false.
 */
export function isDevMode() {
    var monitor = window["IonicDevServer"];
    return isDefined(monitor) &&
        isFunction(monitor.handleError);
    // ||
    // isAngularDevMode();
}
//# sourceMappingURL=devmode.js.map