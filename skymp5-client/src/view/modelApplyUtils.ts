import { ObjectReference, Actor, Game, FormType, TextureSet, NetImmerse } from "skyrimPlatform";
import { Inventory, applyInventory } from "../sync/inventory";
import { logError, logTrace } from "../logging";

// For 0xff000000+ used from FormView
// For objects from master files used directly from remoteServer.ts
export class ModelApplyUtils {
  static applyModelInventory(refr: ObjectReference, inventory: Inventory) {
    applyInventory(refr, inventory, false, true);
  }

  static applyModelIsOpen(refr: ObjectReference, isOpen: boolean) {
    refr.setOpen(isOpen);

    // See also objectReferenceEx.ts
    const caveGSecretDoor01 = 0x6f703;

    // TODO: add more activators to support more cells
    const parentActivatorId = 0x460ca;

    if (refr.getBaseObject()?.getFormID() === caveGSecretDoor01) {
      const openOrOpening = [1, 2].includes(refr.getOpenState());
      if (openOrOpening) {
        if (!isOpen) {
          refr.activate(ObjectReference.from(Game.getForm(parentActivatorId)), false);
        }
      }
      if (!openOrOpening) {
        if (isOpen) {
          refr.activate(ObjectReference.from(Game.getForm(parentActivatorId)), false);
        }
      }
    }
  }

  static applyModelIsDisabled(refr: ObjectReference, disabled: boolean): void {
    const wasDisabled: boolean = refr.isDisabled();
    if (wasDisabled == disabled) return;

    if (disabled) {
      refr.disable(false);
    } else {
      refr.enable(true);
    }
  }

  static applyModelIsHarvested(refr: ObjectReference, isHarvested: boolean) {
    const base = refr.getBaseObject();
    if (base) {
      const t = base.getType();
      if (t == FormType.Tree || t == FormType.Flora) {
        const wasHarvested = refr.isHarvested();
        if (isHarvested != wasHarvested) {
          let ac: Actor | null = null;
          if (isHarvested) {
            for (let i = 0; i < 20; ++i) {
              ac = Game.findRandomActor(
                refr.getPositionX(),
                refr.getPositionY(),
                refr.getPositionZ(),
                10000
              );
              if (ac && ac.getFormID() !== 0x14) {
                break;
              }
            }
          }
          if (isHarvested && ac && ac.getFormID() !== 0x14) {
            refr.activate(ac, true);
          } else {
            refr.setHarvested(isHarvested);
            const id = refr.getFormID();
            refr.disable(false).then(() => {
              const restoredRefr = ObjectReference.from(Game.getFormEx(id));
              if (restoredRefr) restoredRefr.enable(false);
            });
          }
        }
      } else {
        const wasHarvested = refr.isDisabled();
        if (isHarvested != wasHarvested) {
          if (isHarvested) {
            const id = refr.getFormID();
            refr.disable(false).then(() => {
              const restoredRefr = ObjectReference.from(Game.getFormEx(id));
              if (restoredRefr && !restoredRefr.isDisabled()) {
                restoredRefr.delete();
                // Deletion takes time, so in practice this would be called a lot of times
              }
            });
          } else {
            refr.enable(true);
          }
        }
      }
    }
  }

  static applyModelNodeTextureSet(refr: ObjectReference, setNodeTextureSet?: Record<string, number>) {
    if (setNodeTextureSet) {
      for (const key in setNodeTextureSet) {
        const textureSetId = setNodeTextureSet[key];
        const firstPerson = false;

        const textureSet = TextureSet.from(Game.getFormEx(textureSetId));
        if (textureSet !== null) {
          NetImmerse.setNodeTextureSet(refr, key, textureSet, firstPerson);
          logTrace("ModelApplyUtils", refr.getFormID().toString(16), `Applied texture set`, textureSetId.toString(16), `to`, key);
        } else {
          logError("ModelApplyUtils", refr.getFormID().toString(16), `Failed to apply texture set`, textureSetId.toString(16), `to`, key);
        }
      }
    }
  }

  static applyModelNodeScale(refr: ObjectReference, setNodeScale?: Record<string, number>) {
    if (setNodeScale) {
      for (const key in setNodeScale) {
        const scale = setNodeScale[key];
        const firstPerson = false;
        NetImmerse.setNodeScale(refr, key, scale, firstPerson);
        logTrace("ModelApplyUtils", refr.getFormID().toString(16), `Applied node scale`, scale, `to`, key);
      }
    }
  }
}
