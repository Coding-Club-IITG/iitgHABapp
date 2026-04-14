import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Dropdown Demo',
      home: MessChangeReq(),
    );
  }
}

class MessChangeReq extends StatefulWidget {
  const MessChangeReq({super.key});

  @override
  State<MessChangeReq> createState() => _MessChangeReqState();
}

class _MessChangeReqState extends State<MessChangeReq> {
  String? selectedValue;

  final List<String> items = [
    'Bramhaputra',
    'Lohit',
    'Umiam',
    'Barak',
    'Disang',
    'Kapili',
    'Dhansiri',
    'Siang',
    'Subansiri',
    'Dihing',
    'Gaurang',
    'Manas',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Mess Change',
          style: TextStyle(
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      backgroundColor: Colors.white,
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            const Text('Choose the mess that suits your taste or convenience'),
            const SizedBox(height: 10),
            DropdownButton<String>(
              hint: const Text('First Preference'),
              value: selectedValue,
              icon: const Icon(Icons.keyboard_arrow_down),
              elevation: 16,
              style: const TextStyle(color: Colors.deepPurple),
              underline: Container(
                height: 2,
                color: Colors.deepPurpleAccent,
              ),
              onChanged: (String? newValue) {
                setState(() {
                  selectedValue = newValue;
                });
              },
              items: items.map<DropdownMenuItem<String>>((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Text(value),
                );
              }).toList(),
            ),
            const SizedBox(height: 10),
            DropdownButton<String>(
              hint: const Text('Second Preference'),
              value: selectedValue,
              icon: const Icon(Icons.keyboard_arrow_down),
              elevation: 16,
              style: const TextStyle(color: Colors.deepPurple),
              underline: Container(
                height: 2,
                color: Colors.deepPurpleAccent,
              ),
              onChanged: (String? newValue) {
                setState(() {
                  selectedValue = newValue;
                });
              },
              items: items.map<DropdownMenuItem<String>>((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Text(value),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}
