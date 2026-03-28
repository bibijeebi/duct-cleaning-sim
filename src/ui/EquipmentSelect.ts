import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  StackPanel,
  Button,
  ScrollViewer,
  Control,
} from '@babylonjs/gui';
import { EQUIPMENT, EquipmentDef } from '../data/equipment';
import { EquipmentSystem } from '../systems/EquipmentSystem';
import { COLORS, UI } from '../utils/constants';

export class EquipmentSelect {
  private _ui: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _itemButtons: Map<string, Button> = new Map();
  private _equipSystem: EquipmentSystem;
  private _onConfirm: (() => void) | null = null;

  constructor(ui: AdvancedDynamicTexture, equipSystem: EquipmentSystem) {
    this._ui = ui;
    this._equipSystem = equipSystem;

    // Full-screen overlay container
    this._container = new Rectangle('equipSelectContainer');
    this._container.width = '600px';
    this._container.height = '500px';
    this._container.cornerRadius = 8;
    this._container.color = COLORS.TEXT_PRIMARY;
    this._container.thickness = 2;
    this._container.background = '#1a1a1aee';
    this._container.isVisible = false;
    this._container.zIndex = 100;
    this._ui.addControl(this._container);

    // Title
    const title = new TextBlock('equipTitle');
    title.text = 'EQUIPMENT LOADOUT';
    title.color = COLORS.TEXT_PRIMARY;
    title.fontSize = 20;
    title.fontFamily = UI.FONT_FAMILY;
    title.height = '40px';
    title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.paddingTop = '10px';
    this._container.addControl(title);

    // Scrollable item list
    const scroll = new ScrollViewer('equipScroll');
    scroll.width = '560px';
    scroll.height = '370px';
    scroll.top = '50px';
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    scroll.barSize = 10;
    scroll.barColor = COLORS.TEXT_PRIMARY;
    this._container.addControl(scroll);

    const panel = new StackPanel('equipPanel');
    panel.width = '540px';
    scroll.addControl(panel);

    // Group by category
    const categories = [...new Set(EQUIPMENT.map(e => e.category))];
    for (const cat of categories) {
      const catLabel = new TextBlock(`cat_${cat}`);
      catLabel.text = `── ${cat.toUpperCase()} ──`;
      catLabel.color = COLORS.TEXT_SECONDARY;
      catLabel.fontSize = 12;
      catLabel.fontFamily = UI.FONT_FAMILY;
      catLabel.height = '25px';
      catLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      panel.addControl(catLabel);

      const items = EQUIPMENT.filter(e => e.category === cat);
      for (const item of items) {
        const btn = Button.CreateSimpleButton(`equipBtn_${item.id}`, `[ ] ${item.name}`);
        btn.width = '520px';
        btn.height = '28px';
        btn.color = COLORS.TEXT_WHITE;
        btn.fontSize = 13;
        btn.fontFamily = UI.FONT_FAMILY;
        btn.background = '#333333';
        btn.cornerRadius = 3;
        btn.thickness = 0;
        btn.paddingTop = '2px';
        btn.paddingBottom = '2px';
        btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

        btn.onPointerUpObservable.add(() => {
          this._equipSystem.toggleLoadoutItem(item.id);
          this._updateButtonState(item.id, btn);
        });

        panel.addControl(btn);
        this._itemButtons.set(item.id, btn);
      }
    }

    // Bottom buttons row
    const bottomPanel = new StackPanel('equipBottomPanel');
    bottomPanel.isVertical = false;
    bottomPanel.height = '40px';
    bottomPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    bottomPanel.paddingBottom = '10px';
    this._container.addControl(bottomPanel);

    // Select All button
    const selectAllBtn = Button.CreateSimpleButton('selectAllBtn', 'SELECT ALL');
    selectAllBtn.width = '150px';
    selectAllBtn.height = '30px';
    selectAllBtn.color = '#000000';
    selectAllBtn.background = COLORS.TEXT_PRIMARY;
    selectAllBtn.fontSize = 13;
    selectAllBtn.fontFamily = UI.FONT_FAMILY;
    selectAllBtn.cornerRadius = 4;
    selectAllBtn.paddingRight = '10px';
    selectAllBtn.onPointerUpObservable.add(() => {
      this._equipSystem.selectAllLoadout();
      this._refreshAllButtons();
    });
    bottomPanel.addControl(selectAllBtn);

    // Confirm button
    const confirmBtn = Button.CreateSimpleButton('confirmBtn', 'CONFIRM LOADOUT');
    confirmBtn.width = '180px';
    confirmBtn.height = '30px';
    confirmBtn.color = '#000000';
    confirmBtn.background = '#44FF44';
    confirmBtn.fontSize = 13;
    confirmBtn.fontFamily = UI.FONT_FAMILY;
    confirmBtn.cornerRadius = 4;
    confirmBtn.onPointerUpObservable.add(() => {
      this._equipSystem.confirmLoadout();
      this.hide();
      if (this._onConfirm) this._onConfirm();
    });
    bottomPanel.addControl(confirmBtn);

    // Count display
    const countText = new TextBlock('equipCount');
    countText.text = '0 items';
    countText.color = COLORS.TEXT_SECONDARY;
    countText.fontSize = 12;
    countText.fontFamily = UI.FONT_FAMILY;
    countText.width = '100px';
    bottomPanel.addControl(countText);

    // Listen for loadout changes to update count
    this._equipSystem.onLoadoutChange.add((items) => {
      countText.text = `${items.length} items`;
    });
  }

  private _updateButtonState(itemId: string, btn: Button): void {
    const selected = this._equipSystem.isInLoadout(itemId);
    const def = EQUIPMENT.find(e => e.id === itemId);
    if (!def) return;

    const textBlock = btn.children[0] as TextBlock;
    if (textBlock) {
      textBlock.text = `${selected ? '[x]' : '[ ]'} ${def.name}`;
    }
    btn.background = selected ? '#2a4a2a' : '#333333';
  }

  private _refreshAllButtons(): void {
    for (const [itemId, btn] of this._itemButtons) {
      this._updateButtonState(itemId, btn);
    }
  }

  show(onConfirm?: () => void): void {
    this._container.isVisible = true;
    this._refreshAllButtons();
    if (onConfirm) this._onConfirm = onConfirm;
  }

  hide(): void {
    this._container.isVisible = false;
  }

  get isVisible(): boolean {
    return this._container.isVisible;
  }
}
