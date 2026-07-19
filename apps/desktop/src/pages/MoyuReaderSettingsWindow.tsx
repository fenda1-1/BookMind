import { useEffect, useState } from 'react';
import { MoyuReaderSettingsPanel } from '../features/reader-core/MoyuReaderSettingsPanel';
import { normalizeMoyuReaderProfile, type MoyuReaderProfile } from '../features/reader-core/moyuReaderSettingsModel';
import { emitMoyuSettingsOpenTab } from '../features/reader-core/readerDomainEvents';
import { loadExtendedSettings, saveExtendedSettings, subscribeSettingsUpdated, type SettingsUpdatedDetail } from '../services/settingsCenterService';

export function MoyuReaderSettingsWindow() {
  const [profile, setProfile] = useState<MoyuReaderProfile>(() => normalizeMoyuReaderProfile(loadExtendedSettings().moyuReaderProfile));
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'preset') {
      emitMoyuSettingsOpenTab({ tab: 'preset' });
    }
  }, []);

  useEffect(() => {
    function refreshProfile(detail: SettingsUpdatedDetail) {
      if (detail?.key !== 'moyuReaderProfile' && !detail?.keys?.includes('moyuReaderProfile')) return;
      setProfile(normalizeMoyuReaderProfile((detail.extended ?? loadExtendedSettings()).moyuReaderProfile));
    }
    return subscribeSettingsUpdated(refreshProfile);
  }, []);

  function updateProfile(next: MoyuReaderProfile) {
    setProfile(next);
    const settings = loadExtendedSettings();
    saveExtendedSettings({ ...settings, moyuReaderProfile: next }, { key: 'moyuReaderProfile', keys: ['moyuReaderProfile'] });
  }

  return (
    <main className="moyu-settings-window">
      <MoyuReaderSettingsPanel profile={profile} onChange={updateProfile} />
    </main>
  );
}
