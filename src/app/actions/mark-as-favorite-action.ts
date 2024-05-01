import { ILIASObject } from "../models/ilias-object";
import {
    ILIASObjectAction,
    ILIASObjectActionAlert,
    ILIASObjectActionNoMessage,
    ILIASObjectActionResult,
} from "./object-action";
import { SynchronizationService } from "../services/synchronization.service";

export class MarkAsFavoriteAction extends ILIASObjectAction {
    constructor(
        public title: string,
        public object: ILIASObject,
        public syncService: SynchronizationService
    ) {
        super();
    }

    async execute(): Promise<ILIASObjectActionResult> {
        await this.object.setIsFavorite(2);

        this.object.needsDownload = true;
        await this.object.save();

        this.syncService.addObjectsToSyncQueue(this.object);
        return Promise.resolve(new ILIASObjectActionNoMessage());
    }

    alert(): ILIASObjectActionAlert | undefined {
        return undefined;
    }
}
