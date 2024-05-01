import { CommonDatabaseOptions, DatabaseBootstraper } from "./database.api";
import { ConnectionOptions, QueryRunner } from "typeorm/browser";
//import {CordovaConnectionOptions} from "typeorm/driver/cordova/CordovaConnectionOptions";

/**
 * Describes a cordova database connection.
 *
 * @author nmaerchy <nm@studer-raimann.ch>
 * @version 1.0.0
 */
export interface CordovaDatabaseConnection
    extends CommonDatabaseOptions<CordovaDatabaseConnection> {
    /**
     * Sets the database name of this connection.
     *
     * @param {string} name - the name of the database
     *
     * @returns {CordovaDatabaseConnection} this connection instance
     */
    setDatabase(name: string): CordovaDatabaseConnection;

    /**
     * Sets the database location of this connection.
     * @see https://github.com/litehelpers/Cordova-sqlite-storage#opening-a-database
     *
     * @param {string} location - where to save the database
     *
     * @returns {CordovaDatabaseConnection} this connection instance
     */
    setLocation(location: string): CordovaDatabaseConnection;
}

/**
 * Cordova database connection implementation.
 *
 * @author nmaerchy <nm@studer-raimann.ch>
 * @version 1.0.0
 */
export class CordovaDatabaseConnectionImpl
    implements CordovaDatabaseConnection, DatabaseBootstraper
{
    private database: string = "cordova_db";
    private location: string = "default";
    private logging: boolean = false;
    private entities: Array<Function> = [];

    constructor(private readonly name: string) {}

    setDatabase(name: string): CordovaDatabaseConnection {
        this.database = name;
        return this;
    }

    setLocation(location: string): CordovaDatabaseConnection {
        this.location = location;
        return this;
    }

    addEntity(
        first: Function,
        ...more: Array<Function>
    ): CordovaDatabaseConnection {
        this.entities.push(first);
        more.forEach((it) => this.entities.push(it));
        return this;
    }

    enableLogging(enable: boolean): CordovaDatabaseConnection {
        this.logging = enable;
        return this;
    }

    getOptions(): ConnectionOptions {
        return <ConnectionOptions>{
            name: this.name,
            type: "cordova",
            database: this.database,
            location: this.location,
            logging: this.logging,
            entities: this.entities,
            dropSchema: false,
            migrationsRun: false,
            synchronize: false,
        };
    }

    async init(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("PRAGMA foreign_keys = ON;");
    }
}
