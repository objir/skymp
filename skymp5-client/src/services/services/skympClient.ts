import {
  printConsole,
  settings,
  storage,
} from 'skyrimPlatform';
import * as networking from './networkingService';
import { setupHooks } from '../../sync/animation';
import { AuthGameData, authGameDataStorageKey } from '../../features/authModel';
import { ClientListener, CombinedController, Sp } from './clientListener';
import { ConnectionFailed } from '../events/connectionFailed';
import { ConnectionDenied } from '../events/connectionDenied';
import { ConnectionMessage } from '../events/connectionMessage';
import { CreateActorMessage } from '../messages/createActorMessage';
import { AuthAttemptEvent } from '../events/authAttemptEvent';
import { logTrace } from '../../logging';
import { SettingsService, TargetPeer } from './settingsService';

printConsole('Hello Multiplayer!');
printConsole('settings:', settings['skymp5-client']);

export class SkympClient extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.controller.emitter.on("connectionFailed", (e) => this.onConnectionFailed(e));
    this.controller.emitter.on("connectionDenied", (e) => this.onConnectionDenied(e));

    this.controller.emitter.on("createActorMessage", (e) => this.onActorCreateMessage(e));

    // TODO: refactor out very similar code in frontHotReloadService.ts
    const authGameData = storage[authGameDataStorageKey] as AuthGameData | undefined;

    const storageHasValidAuthGameData = authGameData?.local || authGameData?.remote;

    if (storageHasValidAuthGameData) {
      logTrace(this, `Recovered AuthGameData from storage, starting client`);
      this.startClient();
    } else {
      logTrace(this, `Unable to recover AuthGameData from storage, requesting auth`);

      // Next tick because we're in constructor of the service, AuthService may not be listening events yet
      this.controller.once("tick", () => {
        this.controller.emitter.emit("authNeeded", {});
      });
      this.controller.emitter.on("authAttempt", (e) => this.onAuthAttempt(e));
    }
  }

  private onAuthAttempt(e: AuthAttemptEvent) {
    logTrace(this, `Caught auth event`);

    storage[authGameDataStorageKey] = e.authGameData;

    this.startClient();

    // TODO: remove this when you will be able to see errors without console
    // this.sp.browser.setFocused(false);
  }

  private onActorCreateMessage(e: ConnectionMessage<CreateActorMessage>) {
    if (e.message.isMe) {
      this.sp.browser.setFocused(false);
    }
  }

  private onConnectionFailed(e: ConnectionFailed) {
    logTrace(this, "Connection failed");
  }

  private onConnectionDenied(e: ConnectionDenied) {
    logTrace(this, "Connection denied: " + e.error);
  }

  private startClient() {
    // once("tick", ...) is needed to ensure networking service initialized
    this.controller.once("tick", () => this.establishConnectionConditional());
    this.ctor();
  }

  private ctor() {
    // TODO: refactor into service
    setupHooks();

    this.sp.printConsole('SkympClient ctor');
  }

  private establishConnectionConditional() {
    const isConnected = this.controller.lookupListener(networking.NetworkingService).isConnected();
    if (isConnected) {
      logTrace(this, 'Reconnect is not required');
      return;
    }

    this.controller.lookupListener(SettingsService).getTargetPeer(
      ({ host, port }: TargetPeer) => {
        storage.targetIp = host;
        storage.targetPort = port;

        printConsole(`Connecting to ${host}:${port}`);
        this.controller.lookupListener(networking.NetworkingService).connect(host, port);
      },
    );
  }
}
