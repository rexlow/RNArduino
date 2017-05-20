import React, { Component } from 'react'
import {
  AppRegistry,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableHighlight,
  View,
  Modal,
  ActivityIndicator,
  Image
} from 'react-native'

import BluetoothSerial from 'react-native-bluetooth-serial'
import { Buffer } from 'buffer'
global.Buffer = Buffer
const iconv = require('iconv-lite')

import { QRScannerView } from 'ac-qrcode';

const Button = ({ title, onPress, style, textStyle }) =>
  <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
    <Text style={[styles.buttonText, textStyle]}>{title.toUpperCase()}</Text>
  </TouchableOpacity>


const DeviceList = ({ devices, connectedId, showConnectedIcon, onDevicePress }) =>
  <ScrollView style={[styles.container]}>
    <View style={styles.listContainer}>
      {devices.map((device, i) => {
        return (
          <TouchableHighlight
            underlayColor='#DDDDDD'
            key={`${device.id}_${i}`}
            style={styles.listItem} onPress={() => onDevicePress(device)}>
            <View style={{ flexDirection: 'row' }}>
              {showConnectedIcon
                ? (
                  <View style={{ width: 48, height: 48, opacity: 0.4 }}>
                    <Text>{connectedId === device.id ? `${connectedId}` : null}</Text>
                  </View>
                ) : null}
              <View style={{ justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold' }}>{device.name}</Text>
                <Text>{`<${device.id}>`}</Text>
              </View>
            </View>
          </TouchableHighlight>
        )
      })}
    </View>
  </ScrollView>

export default class Arduino extends Component {
  constructor(props) {
    super(props)
    this.state = {
      isEnabled: false,
      discovering: false,
      devices: [],
      unpairedDevices: [],
      connected: false,
      section: 0,
      balance: 80,
      modalVisible: false
    }
  }

  componentWillMount() {
    Promise.all([
      BluetoothSerial.isEnabled(),
      BluetoothSerial.list()
    ])
      .then((values) => {
        const [isEnabled, devices] = values
        this.setState({ isEnabled, devices })
      })

    BluetoothSerial.on('bluetoothEnabled', () => Alert.alert('Bluetooth enabled'))
    BluetoothSerial.on('bluetoothDisabled', () => Alert.alert('Bluetooth disabled'))
    BluetoothSerial.on('error', (err) => console.log(`Error: ${err.message}`))
    BluetoothSerial.on('connectionLost', () => {
      if (this.state.device) {
        Alert.alert(`Connection to device ${this.state.device.name} has been lost`)
      }
      this.setState({ connected: false })
    })
  }

  setModalVisible(visible) {
    this.setState({ modalVisible: visible });
  }

  /**
   * [android]
   * request enable of bluetooth from user
   */
  requestEnable() {
    BluetoothSerial.requestEnable()
      .then((res) => this.setState({ isEnabled: true }))
      .catch((err) => Alert.alert(err.message))
  }

  /**
   * [android]
   * enable bluetooth on device
   */
  enable() {
    BluetoothSerial.enable()
      .then((res) => this.setState({ isEnabled: true }))
      .catch((err) => Alert.alert(err.message))
  }

  /**
   * [android]
   * disable bluetooth on device
   */
  disable() {
    BluetoothSerial.disable()
      .then((res) => this.setState({ isEnabled: false }))
      .catch((err) => Alert.alert(err.message))
  }

  /**
   * [android]
   * toggle bluetooth
   */
  toggleBluetooth(value) {
    if (value === true) {
      this.enable()
    } else {
      this.disable()
    }
  }

  /**
   * [android]
   * Discover unpaired devices, works only in android
   */
  discoverUnpaired() {
    if (this.state.discovering) {
      return false
    } else {
      this.setState({ discovering: true })
      BluetoothSerial.discoverUnpairedDevices()
        .then((unpairedDevices) => {
          this.setState({ unpairedDevices, discovering: false })
        })
        .catch((err) => Alert.alert(err.message))
    }
  }

  /**
   * [android]
   * Discover unpaired devices, works only in android
   */
  cancelDiscovery() {
    if (this.state.discovering) {
      BluetoothSerial.cancelDiscovery()
        .then(() => {
          this.setState({ discovering: false })
        })
        .catch((err) => Alert.alert(err.message))
    }
  }

  /**
   * [android]
   * Pair device
   */
  pairDevice(device) {
    console.log('pairing')
    BluetoothSerial.pairDevice(device.id)
      .then((paired) => {
        console.log(paired)
        if (paired) {
          Alert.alert(`Device ${device.name} paired successfully`)
          const devices = this.state.devices
          devices.push(device)
          this.connect(device)
          this.setState({ devices, unpairedDevices: this.state.unpairedDevices.filter((d) => d.id !== device.id) })
        } else {
          Alert.alert(`Device ${device.name} pairing failed`)
        }
      })
      .catch((err) => Alert.alert(err.message))
  }

  /**
   * Connect to bluetooth device by id
   * @param  {Object} device
   */
  connect(device) {
    console.log('connecting')
    this.setState({ connecting: true })
    BluetoothSerial.connect(device.id)
      .then((res) => {
        Alert.alert('Connected to device the vending machine', 'Please proceed with drink selection!',
        [
          {text: 'Ok', onPress: () => this.setState({ section: 0 })}
        ])
        this.setState({ device, connected: true, connecting: false })
      })
      .catch((err) => Alert.alert(err.message))
  }

  /**
   * Disconnect from bluetooth device
   */
  disconnect() {
    BluetoothSerial.disconnect()
      .then(() => this.setState({ connected: false }))
      .catch((err) => Alert.alert(err.message))
  }

  /**
   * Toggle connection when we have active device
   * @param  {Boolean} value
   */
  toggleConnect(value) {
    if (value === true && this.state.device) {
      this.connect(this.state.device)
    } else {
      this.disconnect()
    }
  }

  /**
   * Write message to device
   * @param  {String} message
   */
  write(message) {
    if (!this.state.connected) {
      Alert.alert('You must connect to device first')
    }

    BluetoothSerial.write(message)
      .then((res) => {
        if (message === "A") {
          this.setState({ balance: this.state.balance - 3 })
          Alert.alert('Drink 1 is purchased!', 'Please enjoy your drink!')
        } else if (message === "B") {
          this.setState({ balance: this.state.balance - 3 })
          Alert.alert('Drink 2 is purchased!', 'Please enjoy your drink!')
        } else if (message === "C") {
          this.setState({ balance: this.state.balance - 3 })
          Alert.alert('Drink 3 is purchased!', 'Please enjoy your drink!')
        }
        this.setState({ connected: true })
      })
      .catch((err) => Alert.alert(err.message))
  }

  onDevicePress(device) {
    if (!this.state.connected) {
      this.pairDevice(device)
    } else {
      this.connect(device)
    }
  }

  writePackets(message, packetSize = 64) {
    const toWrite = iconv.encode(message, 'cp852')
    const writePromises = []
    const packetCount = Math.ceil(toWrite.length / packetSize)

    for (var i = 0; i < packetCount; i++) {
      const packet = new Buffer(packetSize)
      packet.fill(' ')
      toWrite.copy(packet, 0, i * packetSize, (i + 1) * packetSize)
      writePromises.push(BluetoothSerial.write(packet))
    }

    Promise.all(writePromises)
      .then((result) => {
      })
  }

  renderStatusStyle() {
    if (this.state.connected) {
      return { backgroundColor: 'lime' }
    }
  }

  _renderTitleBar() {
    return (
      <View style={{ backgroundColor: 'transparent' }}>
        <Text style={{ color: 'white', textAlignVertical: 'center', textAlign: 'center', font: 20, padding: 12 }}>Scan your favourite yogurt here</Text>
      </View>
    );
  }

  _renderMenu() {
    return (
      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Button
          textStyle={{ color: '#FFFFFF' }}
          style={styles.buttonRaised}
          title='DISMISS'
          onPress={() => this.setModalVisible(false)} />
      </View>
    )
  }

  barcodeReceived(e) {
    console.log(e)
    this.setState({ modalVisible: false }, () => {
      if (this.state.connected) {
        this.write(e.data)
        console.log('sending....')
      } else {
        Alert.alert('Connection to vending machine is lost')
      }
    })
  }

  cameraModal() {
    return (
      <View style={{ flex: 1 }}>
        <QRScannerView
          onScanResultReceived={this.barcodeReceived.bind(this)}
          renderTopBarView={() => this._renderTitleBar()}
          renderBottomMenuView={() => this._renderMenu()}
          hintText=""
        />
      </View>
    )
  }

  renderConnect() {
    if (this.state.enable) {
      if (this.state.devices[0].id === "98:D3:32:20:AD:BD") {
        console.log('vending machine is paired, connecting to it')
        this.connect(this.state.devices[0])
      }
    } else {
      this.enable()
    }
  }

  render() {
    console.log(this.state)
    const activeTabStyle = { borderBottomWidth: 6, borderColor: '#009688' }
    return (
      <View style={[{ flex: 1 }, styles.testShit]}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusStyle, this.renderStatusStyle()]} />
            <Text style={styles.heading}>Yogurt Vending Machine</Text>
          </View>
          {Platform.OS === 'android'
            ? (
              <View style={styles.enableInfoWrapper}>
                <Text style={{ fontSize: 12, color: '#FFFFFF' }}>
                  {this.state.isEnabled ? 'disable' : 'enable'}
                </Text>
                <Switch
                  onValueChange={this.toggleBluetooth.bind(this)}
                  value={this.state.isEnabled} />
              </View>
            ) : null}
        </View>

        {Platform.OS === 'android'
          ? (
            <View style={[styles.topBar, { justifyContent: 'center', paddingHorizontal: 0 }]}>
              <TouchableOpacity style={[styles.tab, this.state.section === 0 && activeTabStyle]} onPress={() => this.setState({ section: 0 })}>
                <Text style={{ fontSize: 14, color: '#FFFFFF' }}>HOME</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, this.state.section === 1 && activeTabStyle]} onPress={() => this.setState({ section: 1 })}>
                <Text style={{ fontSize: 14, color: '#FFFFFF' }}>Connect</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        {this.state.discovering && this.state.section === 1
          ? (
            <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
              <ActivityIndicator
                style={{ marginBottom: 15 }}
                size={60} />
              <Button
                textStyle={{ color: '#FFFFFF' }}
                style={styles.buttonRaised}
                title='Cancel Discovery'
                onPress={() => this.cancelDiscovery()} />
            </View>
          ) : (
            this.state.section === 1 ?
              <DeviceList
                showConnectedIcon={this.state.section === 0}
                connectedId={this.state.device && this.state.device.id}
                devices={this.state.section === 0 ? this.state.devices : this.state.unpairedDevices}
                onDevicePress={(device) => this.onDevicePress(device)} /> :
              <View style={[styles.homeView]}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.titleStyle}>PayWave Balance</Text>
                  <Text style={styles.balanceStyle}>RM {this.state.balance.toString()}</Text>
                </View>
                {this.state.connected ?
                  <Button
                    textStyle={{ color: '#FFFFFF' }}
                    style={styles.buttonRaised}
                    title='Purchase'
                    onPress={() => this.setModalVisible(true)} /> :
                  <Button
                    textStyle={{ color: '#FFFFFF' }}
                    style={styles.buttonRaised}
                    title='Not connected'
                    onPress={() => {
                      this.setState({ section: 1 })
                      this.renderConnect()
                      }} />
                }

                <Modal
                  animationType={"slide"}
                  transparent={false}
                  visible={this.state.modalVisible}
                  onRequestClose={() => { console.log('close') }}
                >
                  {this.cameraModal()}
                </Modal>
              </View>
          )}

        <View style={[{ alignSelf: 'flex-end', height: 52 }]}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.fixedFooter}>
            {Platform.OS === 'android' && this.state.section === 1
              ? (
                <Button
                  title={this.state.discovering ? 'Discovering...' : 'Discover devices'}
                  onPress={this.discoverUnpaired.bind(this)} />
              ) : null}
            {Platform.OS === 'android' && (!this.state.isEnabled && this.state.section === 1)
              ? (
                <Button
                  title='Request enable'
                  onPress={() => this.requestEnable()} />
              ) : null}
          </ScrollView>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 0.9,
    backgroundColor: '#F5FCFF'
  },
  testShit: {
    borderColor: 'red',
    borderWidth: 1,
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 6,
    backgroundColor: '#7B1FA2'
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 16,
    alignSelf: 'center',
    color: '#FFFFFF'
  },
  enableInfoWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tab: {
    alignItems: 'center',
    flex: 0.5,
    height: 56,
    justifyContent: 'center',
    borderBottomWidth: 6,
    borderColor: 'transparent'
  },
  connectionInfoWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25
  },
  connectionInfo: {
    fontWeight: 'bold',
    alignSelf: 'center',
    fontSize: 18,
    marginVertical: 10,
    color: '#238923'
  },
  listContainer: {
    borderColor: '#ccc',
    borderTopWidth: 0.5
  },
  listItem: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    borderColor: '#ccc',
    borderBottomWidth: 0.5,
    justifyContent: 'center'
  },
  fixedFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  },
  button: {
    height: 36,
    margin: 5,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    color: '#7B1FA2',
    fontWeight: 'bold',
    fontSize: 14
  },
  buttonRaised: {
    backgroundColor: '#7B1FA2',
    borderRadius: 2,
    elevation: 2
  },
  sendButtonContainer: {
    position: 'absolute',
    bottom: 20,
    height: 50,
    width: window.width,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  statusStyle: {
    width: 15,
    height: 15,
    backgroundColor: 'red',
    marginRight: 10,
    borderRadius: 10,
  },
  homeView: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10
  },
  titleStyle: {
    fontSize: 24,
    padding: 5
  },
  balanceStyle: {
    fontSize: 30,
  }
})

AppRegistry.registerComponent('Arduino', () => Arduino);
