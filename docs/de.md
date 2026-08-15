# LG webOS

Diese Integration steuert einen LG webOS Fernseher lokal über Gladys Assistant.

## Automatische Erkennung

1. Schalten Sie den Fernseher ein und installieren und starten Sie anschließend die Integration, ohne eine IP-Adresse einzugeben.
2. Öffnen Sie den Tab **Entdecken** und klicken Sie auf **Scannen**.
3. Gladys sendet vom Host-Netzwerk aus eine SSDP-Suche nach `urn:lge-com:service:webos-second-screen:1`.
4. Die Integration liest die UPnP-Beschreibung jedes Fernsehers aus, um dessen Namen, Modell und stabile UDN zu ermitteln.
5. Fügen Sie Ihren Fernseher zu Gladys hinzu. Seine IP-Adresse und UDN werden automatisch gespeichert.
6. Bei der ersten Verbindung erscheint eine webOS-Kopplungsanfrage auf dem Fernseher: Bestätigen Sie diese mit der Fernbedienung.

Die UDN des Fernsehers wird als stabile Kennung verwendet. Bei einem späteren Scan kann daher eine geänderte DHCP-Adresse aktualisiert werden, ohne das Gladys-Gerät neu zu erstellen.

## Wake-on-LAN

SSDP stellt die MAC-Adresse des Fernsehers nicht zuverlässig bereit. Die Erkennung, die Steuerung im eingeschalteten Zustand und das Ausschalten funktionieren ohne sie, aber zum **Einschalten** des Fernsehers über Gladys muss die MAC-Adresse in der Integrationskonfiguration eingetragen sein.

Eine DHCP-Reservierung für den Fernseher wird weiterhin empfohlen.

## Verbindung

Der Modus **Automatisch** versucht zuerst `ws://TV:3000` und anschließend `wss://TV:3001`. Einige neuere webOS-Firmwareversionen benötigen den sicheren Port mit einem selbstsignierten Zertifikat.

Die Integration stellt Funktionen für Ein/Aus, Lautstärke, Stummschaltung, Wiedergabe/Pause/Stopp, Lautstärke +/-, Kanal +/- und Benachrichtigungen auf dem Fernseher bereit.