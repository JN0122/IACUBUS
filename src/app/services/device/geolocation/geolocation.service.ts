import { Observable, TeardownLogic } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { Logger } from "../../logging/logging.api";
import { Logging } from "../../logging/logging.service";

const geoOptions: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 15000,
    timeout: 13500,
};

/**
 * Small abstraction for the browser Geolocation API.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
 *
 * This API needs a secure browser context!
 *
 * @author Nicolas Schaefli <ns@studer-raimann.ch>
 * @version 1.0.0
 * @since 3.0.7
 */
@Injectable()
export class Geolocation {
    private readonly log: Logger = Logging.getLogger("Geolocation");

    private readonly position$: Observable<Position> = new Observable<Position>(
        (subscriber): TeardownLogic => {
            const handle: number = navigator.geolocation.watchPosition(
                (it) => subscriber.next(it),
                (error: PositionError) => {
                    const messages: Map<number, string> = new Map<
                        number,
                        string
                    >();
                    messages.set(error.PERMISSION_DENIED, "PERMISSION_DENIED");
                    messages.set(
                        error.POSITION_UNAVAILABLE,
                        "POSITION_UNAVAILABLE"
                    );
                    messages.set(error.TIMEOUT, "TIMEOUT");
                    if (
                        error.code === error.TIMEOUT ||
                        error.code === error.POSITION_UNAVAILABLE
                    ) {
                        this.log.warn(
                            () =>
                                `TemporaryPositionError: code -> ${
                                    messages.has(error.code)
                                        ? messages.get(error.code)
                                        : error.code
                                } message -> ${error.message}`
                        );
                        return;
                    }
                    this.log.error(
                        () =>
                            `PositionError: code -> ${
                                messages.has(error.code)
                                    ? messages.get(error.code)
                                    : error.code
                            } message -> ${error.message}`
                    );
                    subscriber.error(error);
                },
                geoOptions
            );
            this.log.debug(
                () => `Geolocation API handle acquired -> ${handle}`
            );
            return (): void => {
                navigator.geolocation.clearWatch(handle);
                this.log.debug(
                    () => `Geolocation API handle released -> ${handle}`
                );
            };
        }
    );

    /**
     * Checks if the Geolocation API is defined.
     */
    get isAvailable(): boolean {
        return (
            "geolocation" in navigator &&
            typeof navigator.geolocation === "object"
        );
    }

    /**
     * This initiates an asynchronous request to detect the user's position,
     * and queries the positioning hardware to get up-to-date information.
     *
     * @throws {Error} Throws if the position api is not enabled.
     */
    async getCurrentPosition(): Promise<Position> {
        if (!this.isAvailable) {
            this.log.error(
                () => "Can't fetch position without geolocation api."
            );
            throw new Error("Can't fetch position without geolocation api.");
        }

        return new Promise<Position>((resolve, reject): void => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                geoOptions
            );
        });
    }

    /**
     * Watches the current position of the user.
     * The watch position method can be used without an initial {getCurrentPosition} call.
     *
     * @throws {Error} Throws if the position api is not enabled.
     */
    watchPosition(): Observable<Position> {
        if (!this.isAvailable) {
            this.log.error(
                () => "Can't fetch position without geolocation api."
            );
            throw new Error("Can't fetch position without geolocation api.");
        }

        return this.position$;
    }
}
