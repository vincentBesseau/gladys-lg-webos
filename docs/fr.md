# LG webOS

Cette intégration contrôle localement une TV LG webOS depuis Gladys Assistant.

## Configuration

1. Donnez une IP fixe (ou un bail DHCP statique) à la TV.
2. Renseignez son adresse IP et son adresse MAC dans la configuration de l'intégration.
3. Laissez le mode de connexion sur **Automatique**.
4. Allumez la TV puis cliquez sur **Tester la connexion à la TV**.
5. Acceptez la demande d'association affichée sur la TV. La clé d'association est ensuite conservée par Gladys.

La V1 expose l'alimentation, le volume, le mute, lecture/pause/stop, volume +/-, chaîne +/- et l'envoi de notifications toast.

> Sur certains firmwares récents, webOS impose `wss://TV:3001` avec un certificat auto-signé. Le mode automatique tente d'abord le port 3000 puis le port 3001.
