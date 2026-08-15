# LG webOS

Diese Integration steuert LG webOS Fernseher lokal über Gladys Assistant.

## Automatische Erkennung

1. Schalten Sie den Fernseher ein und installieren und starten Sie anschließend die Integration, ohne eine IP-Adresse einzugeben.
2. Öffnen Sie den Tab **Entdecken** und klicken Sie auf **Scannen**.
3. Gladys sendet vom Host-Netzwerk aus eine SSDP-Suche nach `urn:lge-com:service:webos-second-screen:1`.
4. Die Integration liest die UPnP-Beschreibung jedes Fernsehers aus, um dessen Namen, Modell und stabile UDN zu ermitteln.
5. Fügen Sie Ihren Fernseher zu Gladys hinzu. Seine IP-Adresse und UDN werden automatisch gespeichert.
6. Bei der ersten Verbindung erscheint eine webOS-Kopplungsanfrage auf dem Fernseher: Bestätigen Sie diese mit der Fernbedienung.

Die UDN des Fernsehers wird als stabile Kennung verwendet. Bei einem späteren Scan kann daher eine geänderte DHCP-Adresse aktualisiert werden, ohne das Gladys-Gerät neu zu erstellen.

## Wake-on-LAN

SSDP stellt die MAC-Adresse des Fernsehers nicht zuverlässig bereit. Die Steuerung im eingeschalteten Zustand und das Ausschalten funktionieren ohne MAC-Adresse, zum **Einschalten** des Fernsehers über Gladys mit Wake-on-LAN ist sie jedoch erforderlich.

Nachdem Sie einen Fernseher hinzugefügt haben, verwenden Sie in der Integrationskonfiguration die Aktion **Fernseher konfigurieren**, wählen Sie den entsprechenden Fernseher aus und geben Sie seine MAC-Adresse ein.

Jeder hinzugefügte Fernseher besitzt eine eigene Konfiguration, sodass Wake-on-LAN mit mehreren LG webOS Fernsehern verwendet werden kann.

Eine DHCP-Reservierung oder statische IP-Adresse für jeden Fernseher wird empfohlen, auch wenn die Erkennung eine geänderte IP-Adresse erkennen und aktualisieren kann.

## Verbindung

Der Modus **Automatisch** versucht zuerst `ws://TV:3000` und anschließend `wss://TV:3001`. Einige neuere webOS-Firmwareversionen benötigen den sicheren Port mit einem selbstsignierten Zertifikat.

Die Integration hält für jeden konfigurierten Fernseher eine WebSocket-Verbindung aufrecht. Wenn die Verbindung unerwartet unterbrochen wird, versucht sie automatisch, die Verbindung wiederherzustellen. Nach dem Einschalten über Wake-on-LAN wartet die Integration, bis webOS verfügbar ist, und stellt die Verbindung anschließend automatisch wieder her.

Die Integration stellt Funktionen für Ein/Aus, Lautstärke, Stummschaltung, Wiedergabe/Pause/Stopp, Lautstärke +/-, Kanal +/- und Benachrichtigungen auf dem Fernseher bereit.