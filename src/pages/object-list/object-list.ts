import {Component, Inject} from "@angular/core";
import {
  NavController, NavParams, ActionSheetController, AlertController,
  ToastController, Events, ActionSheetOptions, ActionSheetButton, Refresher, AlertOptions, ActionSheet, Toast, Alert
} from "ionic-angular";
import {DataProvider} from "../../providers/data-provider.provider";
import {ILIASObject} from "../../models/ilias-object";
import {Builder} from "../../services/builder.base";
import {FileService} from "../../services/file.service";
import {User} from "../../models/user";
import {LINK_BUILDER, LinkBuilder} from "../../services/link/link-builder.service";
import {SynchronizationService, SyncResults} from "../../services/synchronization.service";
import {ILIASObjectAction, ILIASObjectActionResult, ILIASObjectActionSuccess} from "../../actions/object-action";
import {ShowObjectListPageAction} from "../../actions/show-object-list-page-action";
import {OPEN_OBJECT_IN_ILIAS_ACTION_FACTORY, OpenObjectInILIASAction} from "../../actions/open-object-in-ilias-action";
import {ShowDetailsPageAction} from "../../actions/show-details-page-action";
import {MarkAsFavoriteAction} from "../../actions/mark-as-favorite-action";
import {UnMarkAsFavoriteAction} from "../../actions/unmark-as-favorite-action";
import {MarkAsOfflineAvailableAction} from "../../actions/mark-as-offline-available-action";
import {UnMarkAsOfflineAvailableAction} from "../../actions/unmark-as-offline-available-action";
import {SynchronizeAction} from "../../actions/synchronize-action";
import {RemoveLocalFilesAction} from "../../actions/remove-local-files-action";
import {DesktopItem} from "../../models/desktop-item";
import {FooterToolbarService} from "../../services/footer-toolbar.service";
import {DownloadAndOpenFileExternalAction} from "../../actions/download-and-open-file-external-action";
import {TranslateService} from "ng2-translate/src/translate.service";
import {Log} from "../../services/log.service";
import {Job} from "../../services/footer-toolbar.service";
import {ModalController} from "ionic-angular";
import {SyncFinishedModal} from "../sync-finished-modal/sync-finished-modal";
import {CantOpenFileTypeException} from "../../exceptions/CantOpenFileTypeException";
import {NoWLANException} from "../../exceptions/noWLANException";
import {OfflineException} from "../../exceptions/OfflineException";
import {RESTAPIException} from "../../exceptions/RESTAPIException";
import {ILIASLinkBuilder, ILIASLinkView, TokenUrlConverter} from "../../services/url-converter.service";
import {PageLayout} from "../../models/page-layout";
import {Exception} from "../../exceptions/Exception";
import {TimeLine} from "../../models/timeline";
import {InAppBrowser} from "@ionic-native/in-app-browser";
import {AlertButton} from "ionic-angular/components/alert/alert-options";
import {TimeoutError} from "rxjs/Rx";
import {HttpRequestError, UnfinishedHttpRequestError} from "../../providers/http";
import {Logger} from "../../services/logging/logging.api";
import {Logging} from "../../services/logging/logging.service";
import {OPEN_LEARNPLACE_ACTION_FACTORY, OpenLearnplaceActionFunction} from "../../actions/open-learnplace-action";


@Component({
	templateUrl: "object-list.html",
})
export class ObjectListPage {

	/**
	 * Objects under the given parent object
	 */
	objects: Array<ILIASObject> = [];

	/**
	 * The parent container object that was clicked to display the current objects
	 */
	parent: ILIASObject;
	pageTitle: string;
	user: User;
	actionSheetActive: boolean = false;

	private readonly log: Logger = Logging.getLogger(ObjectListPage.name);

	readonly pageLayout: PageLayout;
	readonly timeline: TimeLine;

	constructor(private readonly nav: NavController,
				params: NavParams,
				private readonly actionSheet: ActionSheetController,
				private readonly file: FileService,
				private readonly sync: SynchronizationService,
				private readonly modal: ModalController,
				private readonly alert: AlertController,
				private readonly toast: ToastController,
				private readonly translate: TranslateService,
				private readonly dataProvider: DataProvider,
				readonly footerToolbar: FooterToolbarService,
				private readonly events: Events,
				private readonly urlConverter: TokenUrlConverter,
				private readonly browser: InAppBrowser,
        @Inject(OPEN_OBJECT_IN_ILIAS_ACTION_FACTORY)
        private readonly openInIliasActionFactory: (title: string, urlBuilder: Builder<Promise<string>>) => OpenObjectInILIASAction,
        @Inject(OPEN_LEARNPLACE_ACTION_FACTORY)
        private readonly openLearnplaceActionFactory: OpenLearnplaceActionFunction,
        @Inject(LINK_BUILDER) private readonly linkBuilder: LinkBuilder
	) {
		this.parent = params.get("parent");

		if (this.parent) {
			this.pageTitle = this.parent.title;
			this.pageLayout = new PageLayout(this.parent.type);
			this.timeline = new TimeLine(this.parent.type);
		} else {
			this.pageTitle = ""; // will be updated by the observer
			this.pageLayout = new PageLayout();
			this.timeline = new TimeLine();
			translate.get("object-list.title").subscribe((lng) => {
				this.pageTitle = lng;
			});
		}
		this.initEventListeners();
	}

	/**
	 * Opens the parent object in ILIAS.
	 */
	openPageLayout(): void {
		this.checkParent();
		const action: ILIASObjectAction = this.openInIliasActionFactory(
		  this.translate.instant("actions.view_in_ilias"),
      this.linkBuilder.default().target(this.parent.refId)
    );
		this.executeAction(action);
	}

	/**
	 * Opens the timeline of the parent object in ILIAS.
	 */
	openTimeline(): void {
		this.checkParent();
		const action: ILIASObjectAction = this.openInIliasActionFactory(
		  this.translate.instant("actions.view_in_ilias"),
      this.linkBuilder.timeline().target(this.parent.refId)
    );
		this.executeAction(action);
	}

	/**
	 * Checks the parent on null.
	 *
	 * @throws Exception if the parent is null
	 */
	private checkParent(): void {
		if (this.parent == undefined) {
			throw new Exception("Can not open link for undefined. Do not call this method on ILIAS objects with no parent.");
		}
	}

	ionViewDidEnter(): void {
		Log.write(this, "Did enter.");
		this.calculateChildrenMarkedAsNew();
	}

	ionViewDidLoad(): void {
		Log.write(this, "Did load page object list.");

		User.currentUser()
      .then(user => {
        this.user = user;

        return this.loadCachedObjects();
      })
      .then(() => {

		    if (this.objects.length == 0 && this.parent == undefined) {
		      this.executeSync();
        }
      });
	}

	private async loadCachedObjects(): Promise<void> {

	  this.user = await User.currentUser();

    if (this.parent == undefined) {
      await this.loadCachedDesktopData();
    } else {
      await this.loadCachedObjectData();
    }

    return Promise.resolve();
  }


	private async loadOnlineObjects(): Promise<void> {

    this.user = await User.currentUser();

    if (this.parent == undefined) {
      await this.loadOnlineDesktopData();
    } else {
      await this.loadOnlineObjectData();
    }

    return Promise.resolve();
  }

	/**
	 * Loads the object data from db cache.
	 * @returns {Promise<void>}
	 */
	private async loadCachedObjectData(): Promise<void> {

	  try {

      this.footerToolbar.addJob(this.parent.refId, "");

      this.objects = await ILIASObject.findByParentRefId(this.parent.refId, this.user.id);
      this.objects.sort(ILIASObject.compare);
      this.calculateChildrenMarkedAsNew();

      this.footerToolbar.removeJob(this.parent.refId);

      return Promise.resolve();

    } catch (error) {
	    this.footerToolbar.removeJob(this.parent.refId);
	    return Promise.reject(error);
    }
	}

	/**
	 * loads the object data from the rest api and stores it into the db chache.
	 * @returns {Promise<void>}
	 */
	private async loadOnlineObjectData(): Promise<void> {

	  try {

      this.footerToolbar.addJob(this.parent.refId, "");

      this.objects = await this.dataProvider.getObjectData(this.parent, this.user, true);
      this.calculateChildrenMarkedAsNew();
      this.footerToolbar.removeJob(this.parent.refId);
      this.parent.updatedAt = new Date().toISOString();

      return Promise.resolve();

    } catch (error) {
	    this.footerToolbar.removeJob(this.parent.refId);
	    return Promise.reject(error);
    }
	}

	/**
	 * load the desktop data from the local db.
	 * @returns {Promise<void>}
	 */
	private async loadCachedDesktopData(): Promise<void> {

	  try {

      this.footerToolbar.addJob(Job.DesktopAction, "");

      this.objects = await DesktopItem.findByUserId(this.user.id);
      this.objects.sort(ILIASObject.compare);
      this.calculateChildrenMarkedAsNew();

      this.footerToolbar.removeJob(Job.DesktopAction);

      return Promise.resolve();

    } catch (error) {
	    this.footerToolbar.removeJob(Job.DesktopAction);
	    return Promise.reject(error);
    }
	}

	/**
	 * load the desktop data from the rest api. and save the data into the local db.
	 * @returns {Promise<void>}
	 */
	private async loadOnlineDesktopData(): Promise<void> {

	  try {

      this.footerToolbar.addJob(Job.DesktopAction, "");

      this.objects = await this.dataProvider.getDesktopData(this.user);
      this.objects.sort(ILIASObject.compare);
      this.calculateChildrenMarkedAsNew();

      this.footerToolbar.removeJob(Job.DesktopAction);

      return Promise.resolve();

    } catch (error) {
	    this.footerToolbar.removeJob(Job.DesktopAction);
	    return Promise.reject(error);
    }
	}

	// TODO: Refactor method to make sure it returns a Promise<void>
	private calculateChildrenMarkedAsNew(): void {
		// Container objects marked as offline available display the number of new children as badge
		this.objects.forEach(iliasObject => {
			if (iliasObject.isContainer()) {
				ILIASObject.findByParentRefIdRecursive(iliasObject.refId, iliasObject.userId).then(iliasObjects => {
					const newObjects: Array<ILIASObject> = iliasObjects.filter((iliasObject: ILIASObject) => {
						return iliasObject.isNew || iliasObject.isUpdated;
					});
					const n: number = newObjects.length;
					Log.describe(this, "Object:", iliasObject);
					Log.describe(this, "Objects marked as new: ", n);
					iliasObject.newSubItems = n;
				});
			} else {
				iliasObject.newSubItems = 0;
			}
		});
	}


	/**
	 * called by pull-to-refresh refresher
	 *
	 * @param {Refresher} refresher
	 * @returns {Promise<void>}
	 */
	async startSync(refresher: Refresher) {
		refresher.complete();
		await this.executeSync();
	}

	/**
	 * executes global sync
	 *
	 * @returns {Promise<void>}
	 */
	private async executeSync(): Promise<void> {

		try {

			Log.write(this, "Sync start", [], []);
			this.footerToolbar.addJob(Job.Synchronize, this.translate.instant("synchronisation_in_progress"));

			await this.loadOnlineObjects();

			const syncResult: SyncResults = await this.sync.execute();
			this.calculateChildrenMarkedAsNew();

			// We have some files that were marked but not downloaded. We need to explain why and open a modal.
			if (syncResult.objectsLeftOut.length > 0) {
				const syncModal = this.modal.create(SyncFinishedModal, {syncResult: syncResult});
				syncModal.present();
			} else {
				// If there were no files left out and everything went okay, we just display a "okay" result!
				// this.displaySuccessToast(); // not needed with footer
			}
			//maybe some objects came in new.
			this.footerToolbar.removeJob(Job.Synchronize);

			return Promise.resolve();
		} catch (error) {

			Log.error(this, error);

			this.footerToolbar.removeJob(Job.Synchronize);

			if (error instanceof NoWLANException) {
        this.log.warn(() => "Unable to sync newsPresenters no wlan active.");
				this.displayAlert(this.translate.instant("sync.title"), this.translate.instant("sync.stopped_no_wlan"));
				return Promise.resolve();
			}

			if (error instanceof RESTAPIException) {
        this.log.warn(() => "Unable to sync server not reachable.");
				this.displayAlert(this.translate.instant("sync.title"), this.translate.instant("actions.server_not_reachable"));
				return Promise.resolve();
			}

			if (this.sync.isRunning) {
        this.log.warn(() => "Unable to sync because sync is already running.");
				this.displayAlert(this.translate.instant("sync.title"), this.translate.instant("sync.sync_already_running"));
				return Promise.resolve();
			}

      if(error instanceof TimeoutError) {
        this.log.warn(() => "Unable to sync newsPresenters due to request timeout.");
        this.displayAlert(<string>this.translate.instant("sync.title"), this.translate.instant("actions.server_not_reachable"));
        return;
      }

      if(error instanceof HttpRequestError) {
        this.log.warn(() => `Unable to sync news due to http request error "${error.statuscode}".`);
        this.displayAlert(<string>this.translate.instant("sync.title"), this.translate.instant("actions.server_not_reachable"));
        return;
      }

      if(error instanceof UnfinishedHttpRequestError) {
        this.log.warn(() => `Unable to sync due to http request error with message "${error.message}".`);
        this.displayAlert(<string>this.translate.instant("sync.title"), this.translate.instant("actions.server_not_reachable"));
        return;
      }

			return Promise.reject(error);
		}
	}

	private displayAlert(title: string, message: string) {
		const alert = this.alert.create(<AlertOptions>{
			title: title,
			message: message,
      buttons: [
        <AlertButton>{
			    text: "Ok"
        }
      ]
		});
		alert.present();
	}

	/**
	 * Execute primary action of given object
	 * @param iliasObject
	 */
	onClick(iliasObject: ILIASObject): void {
		if (this.actionSheetActive) return;
		const primaryAction: ILIASObjectAction = this.getPrimaryAction(iliasObject);
		this.executeAction(primaryAction);
		// When executing the primary action, we reset the isNew state
		if (iliasObject.isNew || iliasObject.isUpdated) {
			iliasObject.isNew = false;
			iliasObject.isUpdated = false;
			iliasObject.save();
		}
	}

	/**
	 * Returns the primary action for the given object
	 * @param iliasObject
	 * @returns {ILIASObjectAction}
	 */
	protected getPrimaryAction(iliasObject: ILIASObject): ILIASObjectAction {

		if (iliasObject.isLinked()) {
			return this.openInIliasActionFactory(this.translate.instant("actions.view_in_ilias"), this.linkBuilder.default().target(iliasObject.refId));
		}

		if (iliasObject.isContainer()) {
			return new ShowObjectListPageAction(this.translate.instant("actions.show_object_list"), iliasObject, this.nav);
		}

		if (iliasObject.isLearnplace()) {
		  return this.openLearnplaceActionFactory(this.nav, iliasObject.objId, iliasObject.title);
    }

		if (iliasObject.type == "file") {
			return new DownloadAndOpenFileExternalAction(
			  this.translate.instant("actions.download_and_open_in_external_app"),
        iliasObject,
        this.file,
        this.translate,
        this.alert
      );
		}

    return this.openInIliasActionFactory(this.translate.instant("actions.view_in_ilias"), this.linkBuilder.default().target(iliasObject.refId));
	}

	/**
	 * Show the action sheet for the given object
	 * @param iliasObject
	 */
	showActions(iliasObject: ILIASObject): void {
		this.actionSheetActive = true;
		// let actions = this.objectActions.getActions(object, ILIASObjectActionsService.CONTEXT_ACTION_MENU);
		const actions: Array<ILIASObjectAction> = [
			new ShowDetailsPageAction(this.translate.instant("actions.show_details"), iliasObject, this.nav),
      this.openInIliasActionFactory(this.translate.instant("actions.view_in_ilias"), this.linkBuilder.default().target(iliasObject.refId))
		];
		if (!iliasObject.isFavorite) {
			actions.push(new MarkAsFavoriteAction(this.translate.instant("actions.mark_as_favorite"), iliasObject));
		} else if (iliasObject.isFavorite) {
			actions.push(new UnMarkAsFavoriteAction(this.translate.instant("actions.unmark_as_favorite"), iliasObject));
		}

		if (iliasObject.isContainer() && !iliasObject.isLinked() || iliasObject.type == "file") {
			if (!iliasObject.isOfflineAvailable) {
				actions.push(new MarkAsOfflineAvailableAction(
				  this.translate.instant("actions.mark_as_offline_available"),
          iliasObject,
          this.dataProvider,
          this.sync,
          this.modal)
        );
			} else if (iliasObject.isOfflineAvailable && iliasObject.offlineAvailableOwner != ILIASObject.OFFLINE_OWNER_SYSTEM) {
				actions.push(new UnMarkAsOfflineAvailableAction(this.translate.instant("actions.unmark_as_offline_available"), iliasObject));
				actions.push(new SynchronizeAction(this.translate.instant("actions.synchronize"), iliasObject, this.sync, this.modal, this.translate));
			}
			actions.push(new RemoveLocalFilesAction(this.translate.instant("actions.remove_local_files"), iliasObject, this.file, this.translate));
		}

		const buttons: Array<ActionSheetButton> = actions.map(action => {

			return <ActionSheetButton>{
				text: action.title,
				handler: () => {
					this.actionSheetActive = false;
					// This action displays an alert before it gets executed
					if (action.alert()) {
						const alert = this.alert.create({
							title: action.alert().title,
							subTitle: action.alert().subTitle,
							buttons: [
								{
									text: this.translate.instant("cancel"),
									role: "cancel"
								},
								{
									text: "Ok",
									handler: () => {
										this.executeAction(action);
									}
								}
							]
						});
						alert.present();
					} else {
						this.executeAction(action);
					}
				}
			};

		});

		buttons.push(<ActionSheetButton>{
			text: this.translate.instant("cancel"),
			role: "cancel",
			handler: (): void => {
				this.actionSheetActive = false;
			}
		});

		const options: ActionSheetOptions = {
			title: iliasObject.title,
			buttons: buttons
		};
		const actionSheet: ActionSheet = this.actionSheet.create(options);
		actionSheet.onDidDismiss(() => {
			this.actionSheetActive = false;
		});
		actionSheet.present();
	}


	private handleActionResult(result: ILIASObjectActionResult): void {
		if (!result) return;
		if (result instanceof ILIASObjectActionSuccess) {
			if (result.message) {
				const toast: Toast = this.toast.create({
					message: result.message,
					duration: 3000
				});
				toast.present();
			}
		}
	}

	initEventListeners(): void {
		// We want to refresh after a synchronization.
		this.events.subscribe("sync:complete", () => {
			this.loadCachedObjects();
		});
	}

	executeAction(action: ILIASObjectAction): void {
		const hash: number = action.instanceId();
		this.footerToolbar.addJob(hash, "");
		action.execute().then((result) => {
			this.handleActionResult(result);
			this.calculateChildrenMarkedAsNew();
			this.footerToolbar.removeJob(hash);
		}).catch((error: CantOpenFileTypeException) => {
			if (error instanceof CantOpenFileTypeException) {
				this.showAlert(this.translate.instant("actions.cant_open_file"));
				this.footerToolbar.removeJob(hash);
				return Promise.resolve();
			}
			return Promise.reject(error);
		}).catch((error) => {
			Log.error(this, error);
			if (error instanceof NoWLANException) {
				this.footerToolbar.removeJob(Job.Synchronize);
				this.displayAlert(this.translate.instant("sync.title"), this.translate.instant("sync.stopped_no_wlan"));
				return Promise.resolve();
			}
			return Promise.reject(error);
		}).catch(error => {
			if (error instanceof OfflineException) {
				this.showAlert(this.translate.instant("actions.offline_and_no_local_file"));
				this.footerToolbar.removeJob(hash);
				return Promise.resolve();
			}
			return Promise.reject(error);
		}).catch(error => {
			if (error instanceof RESTAPIException) {
				this.showAlert(this.translate.instant("actions.server_not_reachable"));
				this.footerToolbar.removeJob(hash);
				return Promise.resolve();
			}
			return Promise.reject(error);

		}).catch((message) => {

			this.log.warn(() => `Could not execute action: action=${action.constructor.name}, error=${JSON.stringify(message)}`);
			this.showAlert(this.translate.instant("something_went_wrong"));
			this.footerToolbar.removeJob(hash);
		});
	}

	private showAlert(message: string): void {
		const alert: Alert = this.alert.create(<AlertOptions>{
			title: message,
			buttons: [
				<AlertButton>{
					text: this.translate.instant("close"),
					role: "cancel"
				}
			]
		});
		alert.present();
	}

}
